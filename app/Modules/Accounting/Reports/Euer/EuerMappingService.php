<?php

namespace App\Modules\Accounting\Reports\Euer;

use App\Models\Tenant;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\ReportAccountMapping;
use Illuminate\Support\Collection;

class EuerMappingService
{
    public const DEFAULT_YEAR = 2026;

    public function formVersionForYear(int $year): string
    {
        return 'euer-' . $year;
    }

    /**
     * @return array<string, array{label: string, type: string, order: int}>
     */
    public function lines(): array
    {
        return [
            'betriebseinnahmen' => ['label' => 'Betriebseinnahmen (Umsatzerlöse etc.)', 'type' => 'mapped', 'order' => 10],
            'ust_einnahmen' => ['label' => 'Vereinnahmte Umsatzsteuer sowie USt auf Entnahmen', 'type' => 'mapped', 'order' => 20],
            'ust_erstattung' => ['label' => 'Vom Finanzamt erstattete Umsatzsteuer', 'type' => 'mapped', 'order' => 30],
            'wareneinkauf' => ['label' => 'Wareneinkauf, Rohstoffe und Fremdleistungen', 'type' => 'mapped', 'order' => 40],
            'personal' => ['label' => 'Personalkosten', 'type' => 'mapped', 'order' => 50],
            'raumkosten' => ['label' => 'Raumkosten und Grundstücksaufwendungen', 'type' => 'mapped', 'order' => 60],
            'ust_ausgaben' => ['label' => 'Gezahlte Vorsteuerbeträge', 'type' => 'mapped', 'order' => 70],
            'ust_zahlung' => ['label' => 'An das Finanzamt gezahlte Umsatzsteuer', 'type' => 'mapped', 'order' => 80],
            'sonstige_ausgaben' => ['label' => 'Sonstige Betriebsausgaben', 'type' => 'mapped', 'order' => 90],
            'ergebnis' => ['label' => 'Einnahmen-Überschuss (Ergebnis)', 'type' => 'calculated', 'order' => 100],
        ];
    }

    /**
     * @return array<int, array{code: string, target_code: string, value_type: string}>
     */
    public function defaultAccountMappings(): array
    {
        return [
            ['code' => '8100', 'target_code' => 'betriebseinnahmen', 'value_type' => 'balance'],
            ['code' => '8200', 'target_code' => 'betriebseinnahmen', 'value_type' => 'balance'],
            ['code' => '8300', 'target_code' => 'betriebseinnahmen', 'value_type' => 'balance'],
            ['code' => '8400', 'target_code' => 'betriebseinnahmen', 'value_type' => 'balance'],
            ['code' => '8500', 'target_code' => 'betriebseinnahmen', 'value_type' => 'balance'],

            ['code' => '1770', 'target_code' => 'ust_einnahmen', 'value_type' => 'balance'],
            ['code' => '1771', 'target_code' => 'ust_einnahmen', 'value_type' => 'balance'],
            ['code' => '1776', 'target_code' => 'ust_einnahmen', 'value_type' => 'balance'],

            ['code' => '1789', 'target_code' => 'ust_erstattung', 'value_type' => 'balance'],

            ['code' => '3300', 'target_code' => 'wareneinkauf', 'value_type' => 'balance'],
            ['code' => '3400', 'target_code' => 'wareneinkauf', 'value_type' => 'balance'],
            ['code' => '4200', 'target_code' => 'wareneinkauf', 'value_type' => 'balance'],

            ['code' => '4120', 'target_code' => 'personal', 'value_type' => 'balance'],
            ['code' => '4130', 'target_code' => 'personal', 'value_type' => 'balance'],

            ['code' => '4610', 'target_code' => 'raumkosten', 'value_type' => 'balance'],
            ['code' => '4630', 'target_code' => 'raumkosten', 'value_type' => 'balance'],
            ['code' => '4650', 'target_code' => 'raumkosten', 'value_type' => 'balance'],

            ['code' => '1570', 'target_code' => 'ust_ausgaben', 'value_type' => 'balance'],
            ['code' => '1571', 'target_code' => 'ust_ausgaben', 'value_type' => 'balance'],
            ['code' => '1576', 'target_code' => 'ust_ausgaben', 'value_type' => 'balance'],

            ['code' => '1780', 'target_code' => 'ust_zahlung', 'value_type' => 'balance'],

            ['code' => '4909', 'target_code' => 'sonstige_ausgaben', 'value_type' => 'balance'],
            ['code' => '4910', 'target_code' => 'sonstige_ausgaben', 'value_type' => 'balance'],
            ['code' => '4922', 'target_code' => 'sonstige_ausgaben', 'value_type' => 'balance'],
            ['code' => '4950', 'target_code' => 'sonstige_ausgaben', 'value_type' => 'balance'],
            ['code' => '4957', 'target_code' => 'sonstige_ausgaben', 'value_type' => 'balance'],
            ['code' => '7300', 'target_code' => 'sonstige_ausgaben', 'value_type' => 'balance'],
        ];
    }

    public function ensureDefaults(Tenant $tenant, ?string $formVersion = null): void
    {
        $formVersion ??= $this->formVersionForYear(self::DEFAULT_YEAR);
        $accounts = Account::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereIn('code', collect($this->defaultAccountMappings())->pluck('code')->all())
            ->get()
            ->keyBy('code');

        foreach ($this->defaultAccountMappings() as $default) {
            $account = $accounts->get($default['code']);
            if (!$account) {
                continue;
            }

            ReportAccountMapping::withoutGlobalScopes()->firstOrCreate([
                'tenant_id' => $tenant->id,
                'report_type' => 'euer',
                'form_version' => $formVersion,
                'source_type' => 'account',
                'source_public_id' => $account->public_id,
                'target_code' => $default['target_code'],
            ], [
                'value_type' => $default['value_type'],
                'sign' => 1,
            ]);
        }
    }

    /**
     * @return Collection<int, ReportAccountMapping>
     */
    public function mappings(Tenant $tenant, ?string $formVersion = null, bool $ensureDefaults = true): Collection
    {
        $formVersion ??= $this->formVersionForYear(self::DEFAULT_YEAR);
        if ($ensureDefaults) {
            $this->ensureDefaults($tenant, $formVersion);
        }

        return ReportAccountMapping::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('report_type', 'euer')
            ->where('form_version', $formVersion)
            ->orderBy('target_code')
            ->orderBy('source_public_id')
            ->get();
    }
}
