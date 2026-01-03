<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\HasTenantScope;
use App\Models\Invoice;
use App\Models\Product;
use App\Services\InventoryService;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    use HasTenantScope;
    public function index()
    {
        $tenant = $this->getTenantOrFail();
        $invoices = Invoice::where('tenant_id', $tenant->id)
            ->with(['contact', 'lines', 'order'])
            ->orderBy('id', 'desc')
            ->get();
        return response()->json($invoices);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'contact_id' => 'required|exists:contacts,id',
            'order_id' => 'nullable|exists:orders,id',
            'invoice_date' => 'required|date',
            'due_date' => 'required|date',
            'notes' => 'nullable|string',
            'intro_text' => 'nullable|string',
            'payment_terms' => 'nullable|string',
            'footer_note' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.product_id' => 'nullable|exists:products,id',
            'lines.*.description' => 'required|string',
            'lines.*.quantity' => 'required|numeric|min:0',
            'lines.*.unit_price' => 'required|integer',
            'lines.*.tax_rate' => 'required|numeric|min:0',
            'lines.*.account_id' => 'required|exists:accounts,id',
        ]);

        // Generate invoice number (RE-2025-0001) - tenant-scoped
        $tenant = $this->getTenantOrFail();
        $year = date('Y');
        $lastInvoice = Invoice::where('tenant_id', $tenant->id)
            ->where('invoice_number', 'like', "RE-$year-%")
            ->latest('id')
            ->first();
        $nextNumber = $lastInvoice ? intval(substr($lastInvoice->invoice_number, -4)) + 1 : 1;
        $invoiceNumber = sprintf("RE-%s-%04d", $year, $nextNumber);

        // Calculate totals
        $subtotal = 0;
        $taxTotal = 0;

        foreach ($validated['lines'] as $line) {
            $lineTotal = $line['quantity'] * $line['unit_price'];
            $lineTax = round($lineTotal * ($line['tax_rate'] / 100));
            $subtotal += $lineTotal;
            $taxTotal += $lineTax;
        }

        $total = $subtotal + $taxTotal;

        // Create invoice
        $invoice = Invoice::create([
            'invoice_number' => $invoiceNumber,
            'contact_id' => $validated['contact_id'],
            'invoice_date' => $validated['invoice_date'],
            'due_date' => $validated['due_date'],
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'total' => $total,
            'notes' => $validated['notes'] ?? null,
            'intro_text' => $validated['intro_text'] ?? 'Unsere Lieferungen/Leistungen stellen wir Ihnen wie folgt in Rechnung.',
            'payment_terms' => $validated['payment_terms'] ?? 'Zahlbar sofort, rein netto',
            'footer_note' => $validated['footer_note'] ?? 'Vielen Dank für die gute Zusammenarbeit.',
            'order_id' => $validated['order_id'] ?? null,
            'status' => 'draft',
        ]);

        // Create invoice lines
        foreach ($validated['lines'] as $line) {
            $lineTotal = $line['quantity'] * $line['unit_price'];
            $invoice->lines()->create([
                'product_id' => $line['product_id'] ?? null,
                'description' => $line['description'],
                'quantity' => $line['quantity'],
                'unit' => $line['unit'] ?? 'Stück',
                'unit_price' => $line['unit_price'],
                'tax_rate' => $line['tax_rate'],
                'line_total' => $lineTotal,
                'account_id' => $line['account_id'],
            ]);
        }

        // Update order status if invoice was created from an order
        if (!empty($validated['order_id'])) {
            $order = \App\Models\Order::find($validated['order_id']);
            if ($order) {
                $order->update(['status' => 'invoiced']);
            }
        }

        return response()->json($invoice->load(['contact', 'lines']), 201);
    }

    public function show(Request $request, int $id)
    {
        $tenant = $this->getTenantOrFail();
        $invoice = Invoice::where('tenant_id', $tenant->id)->findOrFail($id);
        
        return response()->json($invoice->load(['contact', 'lines.account']));
    }

    public function destroy(Invoice $invoice)
    {
        if ($invoice->status !== 'draft') {
            return response()->json(['error' => 'Nur Entwürfe können gelöscht werden'], 400);
        }

        // Reset order status if invoice was created from an order
        if ($invoice->order_id) {
            $order = \App\Models\Order::find($invoice->order_id);
            if ($order) {
                $order->update(['status' => 'open']);
            }
        }

        // Hard delete for drafts (Invoice doesn't use SoftDeletes)
        $invoice->delete();
        return response()->json(['message' => 'Rechnung gelöscht']);
    }

    /**
     * Book invoice - creates journal entry (Forderung)
     * Soll: Debitor (Kundenkonto) - Bruttobetrag
     * Haben: Erlöse - Nettobetrag (pro Position)
     * Haben: Umsatzsteuer - Steuerbetrag
     */
    public function book(Invoice $invoice)
    {
        try {
            if ($invoice->status !== 'draft') {
                return response()->json(['error' => 'Rechnung ist bereits gebucht'], 400);
            }

            // Load relationships
            $invoice->load(['contact.account', 'lines.account']);

            // Check if contact exists and has name
            if (!$invoice->contact) {
                return response()->json(['error' => 'Kunde nicht gefunden'], 400);
            }

            // Check if contact has an account
            if (!$invoice->contact->customer_account_id) {
                return response()->json(['error' => "Kunde '{$invoice->contact->name}' hat kein Debitorenkonto. Bitte Kunden neu anlegen."], 400);
            }

            // Create journal entry
            $journalEntry = \App\Modules\Accounting\Models\JournalEntry::create([
                'booking_date' => $invoice->invoice_date,
                'description' => "Rechnung {$invoice->invoice_number} - {$invoice->contact->name}",
                'contact_id' => $invoice->contact_id,
                'status' => 'posted',
            ]);

            // 1. Soll: Debitor (customer account) - Bruttobetrag
            \App\Modules\Accounting\Models\JournalEntryLine::create([
                'journal_entry_id' => $journalEntry->id,
                'account_id' => $invoice->contact->customer_account_id,
                'type' => 'debit',
                'amount' => $invoice->total,
            ]);

            // 2. Haben: Erlöse (per line) - Nettobetrag
            // Group by account and tax rate
            $revenueGroups = [];
            foreach ($invoice->lines as $line) {
                $key = $line->account_id . '_' . $line->tax_rate;
                if (!isset($revenueGroups[$key])) {
                    $revenueGroups[$key] = [
                        'account_id' => $line->account_id,
                        'tax_rate' => $line->tax_rate,
                        'subtotal' => 0,
                    ];
                }
                $revenueGroups[$key]['subtotal'] += $line->line_total;
            }

            foreach ($revenueGroups as $group) {
                \App\Modules\Accounting\Models\JournalEntryLine::create([
                    'journal_entry_id' => $journalEntry->id,
                    'account_id' => $group['account_id'],
                    'type' => 'credit',
                    'amount' => $group['subtotal'],
                ]);
            }

            // 3. Haben: Umsatzsteuer (if applicable)
            if ($invoice->tax_total > 0) {
                // Find tax account based on tax rate
                // Assuming account codes: 1776 (19% USt), 1771 (7% USt)
                $taxAccount = \App\Modules\Accounting\Models\Account::where('code', '1776')->first();
                
                if (!$taxAccount) {
                    // Try to find any tax account
                    $taxAccount = \App\Modules\Accounting\Models\Account::where('code', 'like', '177%')->first();
                }
                
                if ($taxAccount) {
                    \App\Modules\Accounting\Models\JournalEntryLine::create([
                        'journal_entry_id' => $journalEntry->id,
                        'account_id' => $taxAccount->id,
                        'type' => 'credit',
                        'amount' => $invoice->tax_total,
                    ]);
                }
            }

            // Update invoice with journal entry reference
            $invoice->update([
                'status' => 'booked',
                'journal_entry_id' => $journalEntry->id,
            ]);

            // Reduce inventory for products with tracking enabled
            $inventoryService = new InventoryService();
            foreach ($invoice->lines as $line) {
                // Check if line has a product_id
                if (!empty($line->product_id)) {
                    $product = Product::find($line->product_id);
                    if ($product) {
                        $inventoryService->removeStock(
                            $product,
                            $line->quantity,
                            'sale',
                            "Verkauf via Rechnung {$invoice->invoice_number}",
                            $invoice
                        );
                    }
                }
            }

            return response()->json($invoice->load(['contact', 'lines', 'journalEntry']));
            
        } catch (\Exception $e) {
            \Log::error('Invoice booking failed', [
                'invoice_id' => $invoice->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Fehler beim Buchen der Rechnung: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Record payment for invoice
     * Soll: Kasse/Bank - Bruttobetrag
     * Haben: Debitor - Bruttobetrag
     */
    public function recordPayment(Request $request, Invoice $invoice)
    {
        $validated = $request->validate([
            'payment_account_id' => 'required|exists:accounts,id', // Kasse oder Bank
            'payment_date' => 'required|date',
        ]);

        if ($invoice->status !== 'booked' && $invoice->status !== 'sent') {
            return response()->json(['error' => 'Nur gebuchte/versendete Rechnungen können bezahlt werden'], 400);
        }

        // Create payment journal entry
        $journalEntry = \App\Modules\Accounting\Models\JournalEntry::create([
            'booking_date' => $validated['payment_date'],
            'description' => "Zahlung Rechnung {$invoice->invoice_number} - {$invoice->contact->name}",
            'contact_id' => $invoice->contact_id,
            'status' => 'posted',
        ]);

        // Soll: Kasse/Bank
        \App\Modules\Accounting\Models\JournalEntryLine::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $validated['payment_account_id'],
            'type' => 'debit',
            'amount' => $invoice->total,
        ]);

        // Haben: Debitor
        \App\Modules\Accounting\Models\JournalEntryLine::create([
            'journal_entry_id' => $journalEntry->id,
            'account_id' => $invoice->contact->customer_account_id,
            'type' => 'credit',
            'amount' => $invoice->total,
        ]);

        // Mark invoice as paid
        $invoice->update(['status' => 'paid']);

        return response()->json($invoice->load(['contact', 'lines']));
    }

    /**
     * Update the specified invoice (only drafts can be edited)
     */
    public function update(Request $request, Invoice $invoice)
    {
        // Only allow editing drafts
        if ($invoice->status !== 'draft') {
            return response()->json(['message' => 'Nur Entwürfe können bearbeitet werden'], 403);
        }

        $validated = $request->validate([
            'contact_id' => 'required|exists:contacts,id',
            'invoice_date' => 'required|date',
            'due_date' => 'required|date',
            'intro_text' => 'nullable|string',
            'payment_terms' => 'nullable|string',
            'footer_note' => 'nullable|string',
            'lines' => 'required|array',
            'lines.*.product_id' => 'nullable|exists:products,id',
            'lines.*.description' => 'required|string',
            'lines.*.quantity' => 'required|numeric|min:0',
            'lines.*.unit' => 'required|string',
            'lines.*.unit_price' => 'required|integer',
            'lines.*.tax_rate' => 'required|numeric|min:0',
            'lines.*.account_id' => 'required|exists:accounts,id',
        ]);

        // Calculate totals
        $subtotal = 0;
        $taxTotal = 0;
        foreach ($validated['lines'] as $line) {
            $lineTotal = $line['quantity'] * $line['unit_price'];
            $lineTax = $lineTotal * ($line['tax_rate'] / 100);
            $subtotal += $lineTotal;
            $taxTotal += $lineTax;
        }
        $total = $subtotal + $taxTotal;

        // Update invoice
        $invoice->update([
            'contact_id' => $validated['contact_id'],
            'invoice_date' => $validated['invoice_date'],
            'due_date' => $validated['due_date'],
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'total' => $total,
            'intro_text' => $validated['intro_text'] ?? 'Unsere Lieferungen/Leistungen stellen wir Ihnen wie folgt in Rechnung.',
            'payment_terms' => $validated['payment_terms'] ?? 'Zahlbar sofort, rein netto',
            'footer_note' => $validated['footer_note'] ?? 'Vielen Dank für die gute Zusammenarbeit.',
        ]);

        // Delete old lines and create new ones
        $invoice->lines()->delete();

        foreach ($validated['lines'] as $line) {
            $lineTotal = $line['quantity'] * $line['unit_price'];
            $invoice->lines()->create([
                'product_id' => $line['product_id'] ?? null,
                'description' => $line['description'],
                'quantity' => $line['quantity'],
                'unit' => $line['unit'],
                'unit_price' => $line['unit_price'],
                'tax_rate' => $line['tax_rate'],
                'line_total' => $lineTotal,
                'account_id' => $line['account_id'],
            ]);
        }

        return response()->json($invoice->load(['contact', 'lines']));
    }

    /**
     * Send invoice by email
     */
    public function send(Request $request, Invoice $invoice)
    {
        $tenant = $this->getTenantOrFail();
        
        // Validate tenant ownership
        if ($invoice->tenant_id !== $tenant->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Allow sending from any status (user can resend if needed)

        $validated = $request->validate([
            'to' => 'required|email',
            'cc' => 'nullable|email',
            'subject' => 'required|string',
            'body' => 'required|string',
            'signature' => 'nullable|string',
        ]);

        // Load relations needed for PDF
        $invoice->load(['contact', 'lines.account']);
        $settings = \App\Models\CompanySetting::first();

        // Generate PDF
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('invoices.pdf', [
            'invoice' => $invoice,
            'settings' => $settings,
        ])->setPaper('a4');

        // Save PDF temporarily
        $pdfPath = storage_path("app/temp/invoice-{$invoice->invoice_number}.pdf");
        
        // Ensure directory exists
        if (!is_dir(storage_path('app/temp'))) {
            mkdir(storage_path('app/temp'), 0755, true);
        }
        
        $pdf->save($pdfPath);

        try {
            // Create and send the mailable
            $mail = new \App\Mail\SendDocumentMail(
                $validated['subject'],
                $validated['body'],
                $validated['signature'] ?? '',
                $pdfPath,
                "Rechnung-{$invoice->invoice_number}.pdf"
            );

            $to = $validated['to'];
            if (!empty($validated['cc'])) {
                \Illuminate\Support\Facades\Mail::to($to)
                    ->cc($validated['cc'])
                    ->send($mail);
            } else {
                \Illuminate\Support\Facades\Mail::to($to)->send($mail);
            }

            // Update invoice status only if currently booked
            if ($invoice->status === 'booked') {
                $invoice->update(['status' => 'sent']);
            }

            // Clean up temp file
            if (file_exists($pdfPath)) {
                unlink($pdfPath);
            }

            return response()->json([
                'message' => 'Rechnung erfolgreich versendet',
                'invoice' => $invoice->fresh(['contact', 'lines']),
            ]);
        } catch (\Exception $e) {
            // Clean up temp file on error
            if (file_exists($pdfPath)) {
                unlink($pdfPath);
            }
            
            return response()->json([
                'error' => 'Fehler beim Senden der E-Mail: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download invoice as PDF
     */
    public function downloadPDF(Request $request, int $id)
    {
        $tenant = $this->getTenantOrFail();
        $invoice = Invoice::where('tenant_id', $tenant->id)->findOrFail($id);
        
        $invoice->load(['contact', 'lines.account']);
        $settings = \App\Models\CompanySetting::first();
        
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('invoices.pdf', [
            'invoice' => $invoice,
            'settings' => $settings,
        ])->setPaper('a4');
        
        return $pdf->download("Rechnung-{$invoice->invoice_number}.pdf");
    }
}

