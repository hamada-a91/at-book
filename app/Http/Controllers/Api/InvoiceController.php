<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function index()
    {
        $invoices = Invoice::with(['contact', 'lines'])->latest()->get();
        return response()->json($invoices);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'contact_id' => 'required|exists:contacts,id',
            'invoice_date' => 'required|date',
            'due_date' => 'required|date',
            'notes' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.description' => 'required|string',
            'lines.*.quantity' => 'required|numeric|min:0',
            'lines.*.unit_price' => 'required|integer',
            'lines.*.tax_rate' => 'required|numeric|min:0',
            'lines.*.account_id' => 'required|exists:accounts,id',
        ]);

        // Generate invoice number (RE-2025-0001)
        $year = date('Y');
        $lastInvoice = Invoice::where('invoice_number', 'like', "RE-$year-%")->latest('id')->first();
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
            'status' => 'draft',
        ]);

        // Create invoice lines
        foreach ($validated['lines'] as $line) {
            $lineTotal = $line['quantity'] * $line['unit_price'];
            $invoice->lines()->create([
                'description' => $line['description'],
                'quantity' => $line['quantity'],
                'unit_price' => $line['unit_price'],
                'tax_rate' => $line['tax_rate'],
                'line_total' => $lineTotal,
                'account_id' => $line['account_id'],
            ]);
        }

        return response()->json($invoice->load(['contact', 'lines']), 201);
    }

    public function show(Invoice $invoice)
    {
        return response()->json($invoice->load(['contact', 'lines.account']));
    }

    public function destroy(Invoice $invoice)
    {
        if ($invoice->status !== 'draft') {
            return response()->json(['error' => 'Nur Entwürfe können gelöscht werden'], 400);
        }

        $invoice->delete();
        return response()->json(['message' => 'Rechnung gelöscht']);
    }

    /**
     * Book invoice - creates journal entry
     */
    public function book(Invoice $invoice)
    {
        if ($invoice->status !== 'draft') {
            return response()->json(['error' => 'Rechnung ist bereits gebucht'], 400);
        }

        // TODO: Create journal entry logic here
        // For now, just update status
        $invoice->update(['status' => 'booked']);

        return response()->json($invoice->load(['contact', 'lines']));
    }
}
