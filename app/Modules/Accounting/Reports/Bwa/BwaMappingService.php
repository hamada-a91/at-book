<?php

namespace App\Modules\Accounting\Reports\Bwa;

use App\Models\Tenant;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\ReportAccountMapping;
use Illuminate\Support\Collection;

class BwaMappingService
{
    public const FORM_VERSION = 'bwa-v1';

    /**
     * @return array<string, array{label: string, type: string, order: int}>
     */
    public function lines(): array
    {
        return [
            'revenue' => ['label' => 'Umsatzerlöse', 'type' => 'mapped', 'order' => 10],
            'material' => ['label' => 'Material-/Wareneinsatz', 'type' => 'mapped', 'order' => 20],
            'gross_profit' => ['label' => 'Rohertrag', 'type' => 'calculated', 'order' => 30],
            'personnel' => ['label' => 'Personalkosten', 'type' => 'mapped', 'order' => 40],
            'room' => ['label' => 'Raumkosten', 'type' => 'mapped', 'order' => 50],
            'insurance' => ['label' => 'Versicherungen/Beiträge', 'type' => 'mapped', 'order' => 60],
            'vehicle' => ['label' => 'Kfz-Kosten', 'type' => 'mapped', 'order' => 70],
            'advertising_travel' => ['label' => 'Werbe-/Reisekosten', 'type' => 'mapped', 'order' => 80],
            'depreciation' => ['label' => 'Abschreibungen', 'type' => 'mapped', 'order' => 90],
            'other_costs' => ['label' => 'Sonstige Kosten', 'type' => 'mapped', 'order' => 100],
            'operating_result' => ['label' => 'Betriebsergebnis', 'type' => 'calculated', 'order' => 110],
        ];
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function defaultAccountCodes(): array
    {
        return [
            'revenue' => ['8100', '8200', '8300', '8400', '8500', '8736'],
            'material' => ['3300', '3400', '4200'],
            'personnel' => ['4120', '4130'],
            'room' => ['4610', '4630', '4650'],
            'insurance' => ['4800'],
            'vehicle' => [],
            'advertising_travel' => ['4600', '4670'],
            'depreciation' => ['4855', '6000', '6200'],
            'other_costs' => ['4909', '4910', '4920', '4922', '4930', '4945', '4950', '4957', '4980', '7300'],
        ];
    }

    public function ensureDefaults(Tenant $tenant, ?string $formVersion = null): void
    {
        $formVersion ??= self::FORM_VERSION;
        $accounts = Account::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereIn('code', collect($this->defaultAccountCodes())->flatten()->filter()->all())
            ->get()
            ->keyBy('code');

        foreach ($this->defaultAccountCodes() as $targetCode => $accountCodes) {
            foreach ($accountCodes as $accountCode) {
                $account = $accounts->get($accountCode);
                if (! $account) {
                    continue;
                }

                ReportAccountMapping::withoutGlobalScopes()->firstOrCreate([
                    'tenant_id' => $tenant->id,
                    'report_type' => 'bwa',
                    'form_version' => $formVersion,
                    'source_type' => 'account',
                    'source_public_id' => $account->public_id,
                    'target_code' => $targetCode,
                ], [
                    'value_type' => 'balance',
                    'sign' => 1,
                ]);
            }
        }
    }

    /**
     * @return Collection<int, ReportAccountMapping>
     */
    public function mappings(Tenant $tenant, ?string $formVersion = null, bool $ensureDefaults = true): Collection
    {
        $formVersion ??= self::FORM_VERSION;
        if ($ensureDefaults) {
            $this->ensureDefaults($tenant, $formVersion);
        }

        return ReportAccountMapping::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('report_type', 'bwa')
            ->where('form_version', $formVersion)
            ->orderBy('target_code')
            ->orderBy('source_public_id')
            ->get();
    }

    /**
     * @return array<int, string>
     */
    public function mappedAccountPublicIds(Tenant $tenant, ?string $formVersion = null): array
    {
        return $this->mappings($tenant, $formVersion)
            ->where('source_type', 'account')
            ->pluck('source_public_id')
            ->unique()
            ->values()
            ->all();
    }
}
