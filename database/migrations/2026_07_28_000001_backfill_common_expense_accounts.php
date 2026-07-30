<?php

use App\Models\Tenant;
use App\Modules\Accounting\Models\Account;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Ergänzt häufig benötigte Aufwandskonten (Rechts-/Beratung, Internet,
 * Lizenzen, Reisekosten, Porto, Buchführung) für ALLE bestehenden Tenants.
 * Neue Tenants erhalten sie über Skr03AccountPlanGenerator::getBaseAccounts().
 * Idempotent: legt ein Konto nur an, wenn der Code für den Tenant fehlt.
 */
return new class extends Migration
{
    private array $accounts = [
        ['code' => '4909', 'name' => 'Aufwendungen für Fremdlizenzen / Rechte', 'category' => 'Sonstige Kosten'],
        ['code' => '4910', 'name' => 'Porto', 'category' => 'Sonstige Kosten'],
        ['code' => '4922', 'name' => 'Internet- / Telekommunikationskosten', 'category' => 'Sonstige Kosten'],
        ['code' => '4670', 'name' => 'Reise- und Übernachtungskosten', 'category' => 'Werbe-/Reisekosten'],
        ['code' => '4950', 'name' => 'Rechts- und Beratungskosten (Anwalt/Steuerberater)', 'category' => 'Sonstige Kosten'],
        ['code' => '4957', 'name' => 'Buchführungskosten', 'category' => 'Sonstige Kosten'],
    ];

    public function up(): void
    {
        foreach (Tenant::all() as $tenant) {
            // Tenant-Kontext für den BelongsToTenant-Global-Scope + HasPublicId.
            app()->instance('currentTenant', $tenant);

            foreach ($this->accounts as $acc) {
                Account::firstOrCreate(
                    ['tenant_id' => $tenant->id, 'code' => $acc['code']],
                    [
                        'name' => $acc['name'],
                        'type' => 'expense',
                        'category' => $acc['category'],
                        'skr03_class' => 4,
                        'account_purpose' => 'income_statement',
                        'default_tax_code' => 'VST19',
                        'default_tax_rate' => 19,
                        'tax_automation_type' => 'default',
                        'is_system' => true,
                        'is_generated' => true,
                    ]
                );
            }
        }
    }

    public function down(): void
    {
        $codes = array_column($this->accounts, 'code');

        // Nur löschen, wenn das Konto NICHT in Buchungszeilen referenziert wird.
        $usedAccountIds = DB::table('journal_entry_lines')->distinct()->pluck('account_id')->all();

        Account::withoutGlobalScopes()
            ->whereIn('code', $codes)
            ->whereNotIn('id', $usedAccountIds ?: [0])
            ->delete();
    }
};
