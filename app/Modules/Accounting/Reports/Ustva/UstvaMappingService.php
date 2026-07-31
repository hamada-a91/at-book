<?php

namespace App\Modules\Accounting\Reports\Ustva;

use App\Models\Tenant;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\ReportAccountMapping;
use Illuminate\Support\Collection;

class UstvaMappingService
{
    public const DEFAULT_YEAR = 2026;

    public function formVersionForYear(int $year): string
    {
        return 'ustva-'.$year;
    }

    /**
     * @return array<string, array{label: string, type: string, order: int}>
     */
    public function kennziffern(): array
    {
        return [
            '81' => ['label' => 'Steuerpflichtige Umsätze zum Steuersatz 19 %', 'type' => 'mapped', 'order' => 10],
            '86' => ['label' => 'Steuerpflichtige Umsätze zum Steuersatz 7 %', 'type' => 'mapped', 'order' => 20],
            '66' => ['label' => 'Abziehbare Vorsteuerbeträge', 'type' => 'mapped', 'order' => 30],
            '83' => ['label' => 'Verbleibende Vorauszahlung / Erstattung', 'type' => 'calculated', 'order' => 40],
        ];
    }

    /**
     * @return array<int, array{code: string, target_code: string, value_type: string}>
     */
    public function defaultAccountMappings(): array
    {
        return [
            ['code' => '8400', 'target_code' => '81', 'value_type' => 'base_amount'],
            ['code' => '8200', 'target_code' => '81', 'value_type' => 'base_amount'],
            ['code' => '1776', 'target_code' => '81', 'value_type' => 'tax_amount'],
            ['code' => '8300', 'target_code' => '86', 'value_type' => 'base_amount'],
            ['code' => '1771', 'target_code' => '86', 'value_type' => 'tax_amount'],
            ['code' => '1576', 'target_code' => '66', 'value_type' => 'tax_amount'],
            ['code' => '1571', 'target_code' => '66', 'value_type' => 'tax_amount'],
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
            if (! $account) {
                continue;
            }

            ReportAccountMapping::withoutGlobalScopes()->firstOrCreate([
                'tenant_id' => $tenant->id,
                'report_type' => 'ustva',
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
            ->where('report_type', 'ustva')
            ->where('form_version', $formVersion)
            ->orderBy('target_code')
            ->orderBy('source_public_id')
            ->get();
    }
}
