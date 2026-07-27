<?php

namespace App\Http\Requests;

use App\Rules\TenantExists;
use Illuminate\Foundation\Http\FormRequest;

class RecordPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'min:1'],
            'payment_date' => ['required', 'date'],
            'payment_account_id' => ['required', new TenantExists('accounts')],
            'bank_transaction_id' => ['nullable', 'integer', 'min:1'],
            'discount_amount' => ['nullable', 'integer', 'min:0'],
            'discount_account_id' => ['nullable', new TenantExists('accounts')],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
