<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\DB;

/**
 * Tenant-scoped Ersatz für die nackte `exists:tabelle,spalte`-Regel.
 *
 * Prüft, dass die referenzierte ID nicht nur existiert, sondern auch dem
 * aktuellen Mandanten (tenant()) gehört. Ohne diese Prüfung könnten Requests
 * IDs fremder Tenants referenzieren (z.B. ein Konto eines anderen Mandanten
 * in einer Buchungszeile), da `exists:accounts,id` nur die reine Existenz
 * über alle Tenants hinweg prüft.
 *
 * Die Fehlermeldung ist bewusst identisch zur generischen "ungültig"-Meldung
 * von Laravels ExistsRule – sie verrät nicht, ob die ID gar nicht existiert
 * oder nur einem anderen Tenant gehört (kein Informationsleck über fremde
 * Datenbestände).
 */
class TenantExists implements ValidationRule
{
    public function __construct(
        private string $table,
        private string $column = 'id'
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $tenant = tenant();

        if (! $tenant) {
            $fail('Kein Mandanten-Kontext.');

            return;
        }

        $exists = DB::table($this->table)
            ->where($this->column, $value)
            ->where('tenant_id', $tenant->id)
            ->exists();

        if (! $exists) {
            $fail('Der ausgewählte Wert für :attribute ist ungültig.');
        }
    }
}
