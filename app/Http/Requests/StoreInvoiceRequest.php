<?php

namespace App\Http\Requests;

use App\Rules\TenantExists;
use Illuminate\Foundation\Http\FormRequest;

/**
 * SPEC-04 (4.4): Validierung aus InvoiceController::store() ausgelagert.
 * Regeln unverändert aus SPEC-03 übernommen (tenant-scoped via TenantExists).
 */
class StoreInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'contact_id' => ['required', new TenantExists('contacts')],
            'order_id' => ['nullable', new TenantExists('orders')],
            'invoice_date' => 'required|date',
            'due_date' => 'required|date',
            'notes' => 'nullable|string',
            'intro_text' => 'nullable|string',
            'payment_terms' => 'nullable|string',
            'footer_note' => 'nullable|string',
            'lines' => 'required|array|min:1',
            'lines.*.product_id' => ['nullable', new TenantExists('products')],
            'lines.*.description' => 'required|string',
            'lines.*.quantity' => 'required|numeric|min:0',
            'lines.*.unit_price' => 'required|integer',
            'lines.*.tax_rate' => 'required|numeric|min:0',
            'lines.*.account_id' => ['required', new TenantExists('accounts')],
        ];
    }
}
