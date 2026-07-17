<?php

namespace App\Http\Requests;

use App\Rules\TenantExists;
use Illuminate\Foundation\Http\FormRequest;

/**
 * SPEC-04 (4.4): Validierung für den Buchungsvorgang einer Rechnung.
 *
 * POST /api/invoices/{invoice}/book selbst hat keine Eingabefelder (die
 * Buchungslogik ergibt sich vollständig aus der Rechnung). Die einzigen
 * verbleibenden Eingaben im Buchungs-Workflow sind die der Zahlungserfassung
 * (POST /api/invoices/{invoice}/payment) - daher wird diese Request-Klasse
 * dort verwendet (tenant-scoped via TenantExists, wie in SPEC-03 vorgegeben).
 */
class BookInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'payment_account_id' => ['required', new TenantExists('accounts')],
            'payment_date' => 'required|date',
        ];
    }
}
