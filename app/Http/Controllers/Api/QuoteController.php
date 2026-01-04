<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\HasTenantScope;
use App\Models\Quote;
use App\Models\Order;
use Illuminate\Http\Request;

class QuoteController extends Controller
{
    use HasTenantScope;

    public function index()
    {
        $tenant = $this->getTenantOrFail();
        $quotes = Quote::where('tenant_id', $tenant->id)
            ->with(['contact', 'lines'])
            ->orderBy('id', 'desc')
            ->get();
        return response()->json($quotes);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'contact_id' => 'required|exists:contacts,id',
            'quote_date' => 'required|date',
            'valid_until' => 'nullable|date',
            'intro_text' => 'nullable|string',
            'payment_terms' => 'nullable|string',
            'footer_note' => 'nullable|string',
            'notes' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.product_id' => 'nullable|exists:products,id',
            'lines.*.description' => 'required|string',
            'lines.*.quantity' => 'required|numeric|min:0',
            'lines.*.unit' => 'nullable|string',
            'lines.*.unit_price' => 'required|integer',
            'lines.*.tax_rate' => 'required|numeric|min:0',
        ]);

        // Generate quote number (AN-2025-0001) - tenant-scoped (include soft-deleted to avoid duplicates)
        $tenant = $this->getTenantOrFail();
        $year = date('Y');
        $lastQuote = Quote::withTrashed()
            ->where('tenant_id', $tenant->id)
            ->where('quote_number', 'like', "AN-$year-%")
            ->latest('id')
            ->first();
        $nextNumber = $lastQuote ? intval(substr($lastQuote->quote_number, -4)) + 1 : 1;
        $quoteNumber = sprintf("AN-%s-%04d", $year, $nextNumber);

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

        // Create quote
        $quote = Quote::create([
            'quote_number' => $quoteNumber,
            'contact_id' => $validated['contact_id'],
            'quote_date' => $validated['quote_date'],
            'valid_until' => $validated['valid_until'] ?? null,
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'total' => $total,
            'intro_text' => $validated['intro_text'] ?? 'Wir freuen uns, Ihnen folgendes Angebot unterbreiten zu dürfen.',
            'payment_terms' => $validated['payment_terms'] ?? 'Zahlbar sofort, rein netto',
            'footer_note' => $validated['footer_note'] ?? 'Wir freuen uns auf Ihre Auftragserteilung.',
            'notes' => $validated['notes'] ?? null,
            'status' => 'draft',
        ]);

        // Create quote lines
        foreach ($validated['lines'] as $line) {
            $lineTotal = $line['quantity'] * $line['unit_price'];
            $quote->lines()->create([
                'product_id' => $line['product_id'] ?? null,
                'description' => $line['description'],
                'quantity' => $line['quantity'],
                'unit' => $line['unit'] ?? 'Stück',
                'unit_price' => $line['unit_price'],
                'tax_rate' => $line['tax_rate'],
                'line_total' => $lineTotal,
            ]);
        }

        return response()->json($quote->load(['contact', 'lines']), 201);
    }

    public function show(Request $request, int $id)
    {
        $tenant = $this->getTenantOrFail();
        $quote = Quote::where('tenant_id', $tenant->id)->findOrFail($id);
        
        return response()->json($quote->load(['contact', 'lines.product', 'order']));
    }

    public function update(Request $request, Quote $quote)
    {
        // Only allow editing drafts
        if ($quote->status !== 'draft') {
            return response()->json(['message' => 'Nur Entwürfe können bearbeitet werden'], 403);
        }

        $validated = $request->validate([
            'contact_id' => 'required|exists:contacts,id',
            'quote_date' => 'required|date',
            'valid_until' => 'nullable|date',
            'intro_text' => 'nullable|string',
            'payment_terms' => 'nullable|string',
            'footer_note' => 'nullable|string',
            'notes' => 'nullable|string',
            'lines' => 'required|array',
            'lines.*.product_id' => 'nullable|exists:products,id',
            'lines.*.description' => 'required|string',
            'lines.*.quantity' => 'required|numeric|min:0',
            'lines.*.unit' => 'required|string',
            'lines.*.unit_price' => 'required|integer',
            'lines.*.tax_rate' => 'required|numeric|min:0',
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

        // Update quote
        $quote->update([
            'contact_id' => $validated['contact_id'],
            'quote_date' => $validated['quote_date'],
            'valid_until' => $validated['valid_until'] ?? null,
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'total' => $total,
            'intro_text' => $validated['intro_text'] ?? 'Wir freuen uns, Ihnen folgendes Angebot unterbreiten zu dürfen.',
            'payment_terms' => $validated['payment_terms'] ?? 'Zahlbar sofort, rein netto',
            'footer_note' => $validated['footer_note'] ?? 'Wir freuen uns auf Ihre Auftragserteilung.',
            'notes' => $validated['notes'] ?? null,
        ]);

        // Delete old lines and create new ones
        $quote->lines()->delete();

        foreach ($validated['lines'] as $line) {
            $lineTotal = $line['quantity'] * $line['unit_price'];
            $quote->lines()->create([
                'product_id' => $line['product_id'] ?? null,
                'description' => $line['description'],
                'quantity' => $line['quantity'],
                'unit' => $line['unit'],
                'unit_price' => $line['unit_price'],
                'tax_rate' => $line['tax_rate'],
                'line_total' => $lineTotal,
            ]);
        }

        return response()->json($quote->load(['contact', 'lines']));
    }

    public function destroy(Quote $quote)
    {
        if ($quote->status !== 'draft') {
            return response()->json(['error' => 'Nur Entwürfe können gelöscht werden'], 400);
        }

        // Hard delete for drafts (permanently remove, no soft delete)
        $quote->forceDelete();
        return response()->json(['message' => 'Angebot gelöscht']);
    }

    /**
     * Send quote to customer
     */
    public function send(Request $request, Quote $quote)
    {
        $tenant = $this->getTenantOrFail();
        
        if ($quote->tenant_id !== $tenant->id) {
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
        $quote->load(['contact', 'lines']);
        $settings = \App\Models\CompanySetting::first();

        // Generate PDF
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('quotes.pdf', [
            'quote' => $quote,
            'settings' => $settings,
        ])->setPaper('a4');

        // Save PDF temporarily
        $pdfPath = storage_path("app/temp/quote-{$quote->quote_number}.pdf");
        
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
                "Angebot-{$quote->quote_number}.pdf"
            );

            $to = $validated['to'];
            if (!empty($validated['cc'])) {
                \Illuminate\Support\Facades\Mail::to($to)
                    ->cc($validated['cc'])
                    ->send($mail);
            } else {
                \Illuminate\Support\Facades\Mail::to($to)->send($mail);
            }

            // Update quote status only if currently draft
            if ($quote->status === 'draft') {
                $quote->update(['status' => 'sent']);
            }

            // Clean up temp file
            if (file_exists($pdfPath)) {
                unlink($pdfPath);
            }

            return response()->json([
                'message' => 'Angebot erfolgreich versendet',
                'quote' => $quote->fresh(['contact', 'lines']),
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
     * Accept quote
     */
    public function accept(Quote $quote)
    {
        if ($quote->status !== 'sent') {
            return response()->json(['error' => 'Nur gesendete Angebote können akzeptiert werden'], 400);
        }

        $quote->update(['status' => 'accepted']);
        return response()->json($quote->load(['contact', 'lines']));
    }

    /**
     * Create order from quote
     */
    public function createOrder(Quote $quote)
    {
        if ($quote->status === 'ordered') {
            return response()->json(['error' => 'Aus diesem Angebot wurde bereits ein Auftrag erstellt'], 400);
        }

        if ($quote->status !== 'accepted') {
            return response()->json(['error' => 'Angebot muss zuerst akzeptiert werden'], 400);
        }

        // Generate order number (include soft-deleted to avoid duplicates)
        $tenant = $this->getTenantOrFail();
        $year = date('Y');
        $lastOrder = Order::withTrashed()
            ->where('tenant_id', $tenant->id)
            ->where('order_number', 'like', "AB-$year-%")
            ->latest('id')
            ->first();
        $nextNumber = $lastOrder ? intval(substr($lastOrder->order_number, -4)) + 1 : 1;
        $orderNumber = sprintf("AB-%s-%04d", $year, $nextNumber);

        // Create order
        $order = Order::create([
            'quote_id' => $quote->id,
            'contact_id' => $quote->contact_id,
            'order_number' => $orderNumber,
            'order_date' => now()->toDateString(),
            'subtotal' => $quote->subtotal,
            'tax_total' => $quote->tax_total,
            'total' => $quote->total,
            'intro_text' => $quote->intro_text,
            'payment_terms' => $quote->payment_terms,
            'footer_note' => $quote->footer_note,
            'notes' => $quote->notes,
            'status' => 'open',
        ]);

        // Copy quote lines to order lines
        foreach ($quote->lines as $quoteLine) {
            $order->lines()->create([
                'product_id' => $quoteLine->product_id,
                'description' => $quoteLine->description,
                'quantity' => $quoteLine->quantity,
                'delivered_quantity' => 0,
                'invoiced_quantity' => 0,
                'unit' => $quoteLine->unit,
                'unit_price' => $quoteLine->unit_price,
                'tax_rate' => $quoteLine->tax_rate,
                'line_total' => $quoteLine->line_total,
            ]);
        }

        // Update quote status and link to order
        $quote->update([
            'status' => 'ordered',
            'order_id' => $order->id,
        ]);

        return response()->json($order->load(['contact', 'lines', 'quote']), 201);
    }

    /**
     * Download quote as PDF
     */
    public function downloadPDF(Request $request, int $id)
    {
        $tenant = $this->getTenantOrFail();
        $quote = Quote::where('tenant_id', $tenant->id)->findOrFail($id);
        
        $quote->load(['contact', 'lines']);
        $settings = \App\Models\CompanySetting::first();
        
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('quotes.pdf', [
            'quote' => $quote,
            'settings' => $settings,
        ])->setPaper('a4');
        
        return $pdf->download("Angebot-{$quote->quote_number}.pdf");
    }
}
