<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\HasTenantScope;
use App\Models\DeliveryNote;
use App\Models\Invoice;
use Illuminate\Http\Request;

class DeliveryNoteController extends Controller
{
    use HasTenantScope;

    public function index()
    {
        $tenant = $this->getTenantOrFail();
        $deliveryNotes = DeliveryNote::where('tenant_id', $tenant->id)
            ->with(['contact', 'lines.orderLine', 'order'])
            ->orderBy('id', 'desc')
            ->get();
        return response()->json($deliveryNotes);
    }

    public function show(Request $request, int $id)
    {
        $tenant = $this->getTenantOrFail();
        $deliveryNote = DeliveryNote::where('tenant_id', $tenant->id)->findOrFail($id);
        
        return response()->json($deliveryNote->load(['contact', 'lines.orderLine', 'order']));
    }

    public function destroy(DeliveryNote $deliveryNote)
    {
        if ($deliveryNote->status !== 'draft') {
            return response()->json(['error' => 'Nur Entwürfe können gelöscht werden'], 400);
        }

        // Restore order line quantities
        foreach ($deliveryNote->lines as $line) {
            $line->orderLine->decrement('delivered_quantity', $line->quantity);
        }

        // Update order status
        $order = $deliveryNote->order;
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
        } else {
            $order->update(['status' => 'open']);
        }

        $deliveryNote->delete();
        return response()->json(['message' => 'Lieferschein gelöscht']);
    }

    /**
     * Create invoice from delivery note
     */
    public function createInvoice(Request $request, DeliveryNote $deliveryNote)
    {
        $validated = $request->validate([
            'invoice_date' => 'required|date',
            'due_date' => 'required|date',
        ]);

        if ($deliveryNote->status === 'invoiced') {
            return response()->json(['error' => 'Dieser Lieferschein wurde bereits in Rechnung gestellt'], 400);
        }

        // Generate invoice number
        $tenant = $this->getTenantOrFail();
        $year = date('Y');
        $lastInvoice = Invoice::where('tenant_id', $tenant->id)
            ->where('invoice_number', 'like', "RE-$year-%")
            ->latest('id')
            ->first();
        $nextNumber = $lastInvoice ? intval(substr($lastInvoice->invoice_number, -4)) + 1 : 1;
        $invoiceNumber = sprintf("RE-%s-%04d", $year, $nextNumber);

        // Calculate totals from delivery note lines
        $subtotal = 0;
        $taxTotal = 0;

        foreach ($deliveryNote->lines as $dnLine) {
            $orderLine = $dnLine->orderLine;
            $lineTotal = $dnLine->quantity * $orderLine->unit_price;
            $lineTax = round($lineTotal * ($orderLine->tax_rate / 100));
            $subtotal += $lineTotal;
            $taxTotal += $lineTax;
        }

        $total = $subtotal + $taxTotal;

        // Create invoice
        $order = $deliveryNote->order;
        $invoice = Invoice::create([
            'order_id' => $order->id,
            'invoice_number' => $invoiceNumber,
            'contact_id' => $deliveryNote->contact_id,
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

        // Create invoice lines from delivery note lines
        foreach ($deliveryNote->lines as $dnLine) {
            $orderLine = $dnLine->orderLine;
            $lineTotal = $dnLine->quantity * $orderLine->unit_price;
            
            $invoice->lines()->create([
                'description' => $dnLine->description,
                'quantity' => $dnLine->quantity,
                'unit' => $dnLine->unit,
                'unit_price' => $orderLine->unit_price,
                'tax_rate' => $orderLine->tax_rate,
                'line_total' => $lineTotal,
                'account_id' => 1, // TODO: Map tax rate to account
            ]);

            // Update order line invoiced quantity
            $orderLine->increment('invoiced_quantity', $dnLine->quantity);
        }

        // Update delivery note status
        $deliveryNote->update(['status' => 'invoiced']);

        // Update order status
        $order->load('lines');
        $allInvoiced = $order->lines->every(function ($line) {
            return $line->invoiced_quantity >= $line->quantity;
        });

        if ($allInvoiced) {
            $order->update(['status' => 'invoiced']);
        } else {
            $order->update(['status' => 'partial_invoiced']);
        }

        return response()->json($invoice->load(['contact', 'lines', 'order']), 201);
    }
}
