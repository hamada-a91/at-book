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
            'lines.*.description' => 'required|string',
            'lines.*.quantity' => 'required|numeric|min:0',
            'lines.*.unit' => 'required|string',
            'lines.*.unit_price' => 'required|integer',
            'lines.*.tax_rate' => 'required|numeric|min:0',
            'lines.*.account_id' => 'required|exists:accounts,id',
        ]);

        // Update invoice
        $invoice->update([
            'contact_id' => $validated['contact_id'],
            'invoice_date' => $validated['invoice_date'],
            'due_date' => $validated['due_date'],
            'intro_text' => $validated['intro_text'] ?? 'Unsere Lieferungen/Leistungen stellen wir Ihnen wie folgt in Rechnung.',
            'payment_terms' => $validated['payment_terms'] ?? 'Zahlbar sofort, rein netto',
            'footer_note' => $validated['footer_note'] ?? 'Vielen Dank für die gute Zusammenarbeit.',
        ]);

        // Delete old lines and create new ones
        $invoice->lines()->delete();

        $subtotal = 0;
        $total = 0;

        foreach ($validated['lines'] as $lineData) {
            $lineTotal = $lineData['quantity'] * $lineData['unit_price'];
            $lineTax = $lineTotal * ($lineData['tax_rate'] / 100);

            $invoice->lines()->create([
                'description' => $lineData['description'],
                'quantity' => $lineData['quantity'],
                'unit' => $lineData['unit'],
                'unit_price' => $lineData['unit_price'],
                'tax_rate' => $lineData['tax_rate'],
                'line_total' => $lineTotal,
                'account_id' => $lineData['account_id'],
            ]);

            $subtotal += $lineTotal;
            $total += $lineTotal + $lineTax;
        }

        $invoice->update([
            'subtotal' => $subtotal,
            'total' => $total,
        ]);

        return response()->json($invoice->load(['contact', 'lines']));
    }
