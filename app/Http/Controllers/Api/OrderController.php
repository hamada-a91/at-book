<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\HasTenantScope;
use App\Models\Order;
use App\Models\DeliveryNote;
use App\Models\Invoice;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    use HasTenantScope;

    public function index()
    {
        $tenant = $this->getTenantOrFail();
        $orders = Order::where('tenant_id', $tenant->id)
            ->with(['contact', 'lines', 'quote'])
            ->orderBy('id', 'desc')
            ->get();
        return response()->json($orders);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'contact_id' => 'required|exists:contacts,id',
            'order_date' => 'required|date',
            'delivery_date' => 'nullable|date',
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

        // Generate order number (AB-2025-0001) - tenant-scoped (include soft-deleted to avoid duplicates)
        $tenant = $this->getTenantOrFail();
        $year = date('Y');
        $lastOrder = Order::withTrashed()
            ->where('tenant_id', $tenant->id)
            ->where('order_number', 'like', "AB-$year-%")
            ->latest('id')
            ->first();
        $nextNumber = $lastOrder ? intval(substr($lastOrder->order_number, -4)) + 1 : 1;
        $orderNumber = sprintf("AB-%s-%04d", $year, $nextNumber);

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

        // Create order
        $order = Order::create([
            'order_number' => $orderNumber,
            'contact_id' => $validated['contact_id'],
            'order_date' => $validated['order_date'],
            'delivery_date' => $validated['delivery_date'] ?? null,
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'total' => $total,
            'intro_text' => $validated['intro_text'] ?? 'Hiermit bestätigen wir Ihren Auftrag.',
            'payment_terms' => $validated['payment_terms'] ?? 'Zahlbar sofort, rein netto',
            'footer_note' => $validated['footer_note'] ?? 'Vielen Dank für Ihren Auftrag.',
            'notes' => $validated['notes'] ?? null,
            'status' => 'open',
        ]);

        // Create order lines
        foreach ($validated['lines'] as $line) {
            $lineTotal = $line['quantity'] * $line['unit_price'];
            $order->lines()->create([
                'product_id' => $line['product_id'] ?? null,
                'description' => $line['description'],
                'quantity' => $line['quantity'],
                'delivered_quantity' => 0,
                'invoiced_quantity' => 0,
                'unit' => $line['unit'] ?? 'Stück',
                'unit_price' => $line['unit_price'],
                'tax_rate' => $line['tax_rate'],
                'line_total' => $lineTotal,
            ]);
        }

        return response()->json($order->load(['contact', 'lines']), 201);
    }

    public function show(Request $request, int $id)
    {
        $tenant = $this->getTenantOrFail();
        $order = Order::where('tenant_id', $tenant->id)->findOrFail($id);
        
        return response()->json($order->load(['contact', 'lines.product', 'quote', 'deliveryNotes', 'invoices']));
    }

    public function update(Request $request, Order $order)
    {
        // Only allow editing open orders
        if (!in_array($order->status, ['open'])) {
            return response()->json(['message' => 'Nur offene Aufträge können bearbeitet werden'], 403);
        }

        $validated = $request->validate([
            'contact_id' => 'required|exists:contacts,id',
            'order_date' => 'required|date',
            'delivery_date' => 'nullable|date',
            'intro_text' => 'nullable|string',
            'payment_terms' => 'nullable|string',
            'footer_note' => 'nullable|string',
            'notes' => 'nullable|string',
            'lines' => 'required|array',
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

        // Update order
        $order->update([
            'contact_id' => $validated['contact_id'],
            'order_date' => $validated['order_date'],
            'delivery_date' => $validated['delivery_date'] ?? null,
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'total' => $total,
            'intro_text' => $validated['intro_text'] ?? 'Hiermit bestätigen wir Ihren Auftrag.',
            'payment_terms' => $validated['payment_terms'] ?? 'Zahlbar sofort, rein netto',
            'footer_note' => $validated['footer_note'] ?? 'Vielen Dank für Ihren Auftrag.',
            'notes' => $validated['notes'] ?? null,
        ]);

        // Delete old lines and create new ones
        $order->lines()->delete();

        foreach ($validated['lines'] as $line) {
            $lineTotal = $line['quantity'] * $line['unit_price'];
            $order->lines()->create([
                'description' => $line['description'],
                'quantity' => $line['quantity'],
                'delivered_quantity' => 0,
                'invoiced_quantity' => 0,
                'unit' => $line['unit'],
                'unit_price' => $line['unit_price'],
                'tax_rate' => $line['tax_rate'],
                'line_total' => $lineTotal,
            ]);
        }

        return response()->json($order->load(['contact', 'lines']));
    }

    public function destroy(Order $order)
    {
        if ($order->status !== 'open') {
            return response()->json(['error' => 'Nur offene Aufträge können gelöscht werden'], 400);
        }

        // Reset quote status to 'accepted' if this order was created from a quote
        if ($order->quote_id) {
            $quote = $order->quote;
            if ($quote) {
                $quote->update([
                    'status' => 'accepted',
                    'order_id' => null,
                ]);
            }
        }

        $order->delete();
        return response()->json(['message' => 'Auftrag gelöscht']);
    }

    /**
     * Create delivery note from order
     */
    public function createDeliveryNote(Request $request, Order $order)
    {
        $validated = $request->validate([
            'delivery_date' => 'required|date',
            'items' => 'required|array|min:1',
            'items.*.order_line_id' => 'required|exists:order_lines,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
        ]);

        // Generate delivery note number
        $tenant = $this->getTenantOrFail();
        $year = date('Y');
        $lastDN = DeliveryNote::where('tenant_id', $tenant->id)
            ->where('delivery_note_number', 'like', "LS-$year-%")
            ->latest('id')
            ->first();
        $nextNumber = $lastDN ? intval(substr($lastDN->delivery_note_number, -4)) + 1 : 1;
        $deliveryNoteNumber = sprintf("LS-%s-%04d", $year, $nextNumber);

        // Create delivery note
        $deliveryNote = DeliveryNote::create([
            'order_id' => $order->id,
            'contact_id' => $order->contact_id,
            'delivery_note_number' => $deliveryNoteNumber,
            'delivery_date' => $validated['delivery_date'],
            'status' => 'draft',
        ]);

        // Create delivery note lines and update order line quantities
        foreach ($validated['items'] as $item) {
            $orderLine = $order->lines()->findOrFail($item['order_line_id']);
            
            // Check if we're not over-delivering
            $remainingQty = $orderLine->quantity - $orderLine->delivered_quantity;
            if ($item['quantity'] > $remainingQty) {
                return response()->json([
                    'error' => "Position '{$orderLine->description}': Liefermenge ({$item['quantity']}) überschreitet verbleibende Menge ({$remainingQty})"
                ], 400);
            }

            // Create delivery note line
            $deliveryNote->lines()->create([
                'order_line_id' => $orderLine->id,
                'description' => $orderLine->description,
                'quantity' => $item['quantity'],
                'unit' => $orderLine->unit,
            ]);

            // Update order line delivered quantity
            $orderLine->increment('delivered_quantity', $item['quantity']);
        }

        // Update order status
        $order->load('lines');
        $allDelivered = $order->lines->every(function ($line) {
            return $line->delivered_quantity >= $line->quantity;
        });

        $partialDelivered = $order->lines->some(function ($line) {
            return $line->delivered_quantity > 0;
        });

        if ($allDelivered) {
            $order->update(['status' => 'delivered']);
        } elseif ($partialDelivered) {
            $order->update(['status' => 'partial_delivered']);
        }

        return response()->json($deliveryNote->load(['contact', 'lines.orderLine', 'order']), 201);
    }

    /**
     * Create invoice from order
     */
    public function createInvoice(Request $request, Order $order)
    {
        $validated = $request->validate([
            'invoice_date' => 'required|date',
            'due_date' => 'required|date',
            'items' => 'required|array|min:1',
            'items.*.order_line_id' => 'required|exists:order_lines,id',
            'items.*.quantity' => 'required|numeric|min:0.01',
        ]);

        // Generate invoice number
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

        foreach ($validated['items'] as $item) {
            $orderLine = $order->lines()->findOrFail($item['order_line_id']);
            
            // Check if we're not over-invoicing
            $remainingQty = $orderLine->quantity - $orderLine->invoiced_quantity;
            if ($item['quantity'] > $remainingQty) {
                return response()->json([
                    'error' => "Position '{$orderLine->description}': Rechnungsmenge ({$item['quantity']}) überschreitet verbleibende Menge ({$remainingQty})"
                ], 400);
            }

            $lineTotal = $item['quantity'] * $orderLine->unit_price;
            $lineTax = round($lineTotal * ($orderLine->tax_rate / 100));
            $subtotal += $lineTotal;
            $taxTotal += $lineTax;
        }

        $total = $subtotal + $taxTotal;

        // Create invoice
        $invoice = Invoice::create([
            'order_id' => $order->id,
            'invoice_number' => $invoiceNumber,
            'contact_id' => $order->contact_id,
            'invoice_date' => $validated['invoice_date'],
            'due_date' => $validated['due_date'],
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'total' => $total,
            'intro_text' => $order->intro_text,
            'payment_terms' => $order->payment_terms,
            'footer_note' => $order->footer_note,
            'status' => 'draft',
        ]);

        // Create invoice lines and update order line quantities
        foreach ($validated['items'] as $item) {
            $orderLine = $order->lines()->findOrFail($item['order_line_id']);
            
            $lineTotal = $item['quantity'] * $orderLine->unit_price;
            
            $invoice->lines()->create([
                'description' => $orderLine->description,
                'quantity' => $item['quantity'],
                'unit' => $orderLine->unit,
                'unit_price' => $orderLine->unit_price,
                'tax_rate' => $orderLine->tax_rate,
                'line_total' => $lineTotal,
                'account_id' => 1, // TODO: Map tax rate to account
            ]);

            // Update order line invoiced quantity
            $orderLine->increment('invoiced_quantity', $item['quantity']);
        }

        // Update order status
        $order->load('lines');
        $allInvoiced = $order->lines->every(function ($line) {
            return $line->invoiced_quantity >= $line->quantity;
        });

        $partialInvoiced = $order->lines->some(function ($line) {
            return $line->invoiced_quantity > 0;
        });

        if ($allInvoiced) {
            $order->update(['status' => 'invoiced']);
        } elseif ($partialInvoiced) {
            $order->update(['status' => 'partial_invoiced']);
        }

        return response()->json($invoice->load(['contact', 'lines', 'order']), 201);
    }

    /**
     * Send order to customer
     */
    public function send(Request $request, Order $order)
    {
        $tenant = $this->getTenantOrFail();
        
        if ($order->tenant_id !== $tenant->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'to' => 'required|email',
            'cc' => 'nullable|email',
            'subject' => 'required|string',
            'body' => 'required|string',
            'signature' => 'nullable|string',
        ]);

        // Load relations needed for PDF
        $order->load(['contact', 'lines']);
        $settings = \App\Models\CompanySetting::first();

        // Generate PDF
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('orders.pdf', [
            'order' => $order,
            'settings' => $settings,
        ])->setPaper('a4');

        // Save PDF temporarily
        $pdfPath = storage_path("app/temp/order-{$order->order_number}.pdf");
        
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
                "Auftragsbestaetigung-{$order->order_number}.pdf"
            );

            $to = $validated['to'];
            if (!empty($validated['cc'])) {
                \Illuminate\Support\Facades\Mail::to($to)
                    ->cc($validated['cc'])
                    ->send($mail);
            } else {
                \Illuminate\Support\Facades\Mail::to($to)->send($mail);
            }

            // Update order status if draft
            if ($order->status === 'draft') {
                $order->update(['status' => 'confirmed']);
            }

            // Clean up temp file
            if (file_exists($pdfPath)) {
                unlink($pdfPath);
            }

            return response()->json([
                'message' => 'Auftragsbestätigung erfolgreich versendet',
                'order' => $order->fresh(['contact', 'lines']),
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
     * Download order as PDF
     */
    public function downloadPDF(Request $request, int $id)
    {
        $tenant = $this->getTenantOrFail();
        $order = Order::where('tenant_id', $tenant->id)->findOrFail($id);
        
        $order->load(['contact', 'lines']);
        $settings = \App\Models\CompanySetting::first();
        
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('orders.pdf', [
            'order' => $order,
            'settings' => $settings,
        ])->setPaper('a4');
        
        return $pdf->download("Auftrag-{$order->order_number}.pdf");
    }
}

