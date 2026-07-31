<?php

namespace App\Modules\Accounting\Reports;

use App\Models\Tenant;
use App\Modules\Accounting\Reports\Concerns\BuildsReportPayload;
use App\Modules\Accounting\Reports\Ustva\UstvaMappingService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class UstvaReport
{
    use BuildsReportPayload;

    private const SUPPORTED_TAX_KEYS = ['UST19', 'UST7', 'VST19', 'VST7'];

    public function __construct(
        private readonly UstvaMappingService $mappings,
        private readonly ReportQueryService $queries,
        private readonly ReportQualityService $quality,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function generate(ReportPeriod $period): array
    {
        $tenant = $this->tenant();
        $calculationPeriod = new ReportPeriod($period->from, $period->to, ReportPeriod::BASIS_POSTED);
        $formVersion = $this->mappings->formVersionForYear((int) $period->to->year);
        $mappingRows = $this->mappings->mappings($tenant, $formVersion);
        $accountSums = $this->accountSums($calculationPeriod);
        $rows = $this->mappedRows($mappingRows, $accountSums);

        $outputTax = ($rows['81']['tax_amount'] ?? 0) + ($rows['86']['tax_amount'] ?? 0);
        $inputTax = $rows['66']['amount'] ?? 0;
        $rows['83']['amount'] = $outputTax - $inputTax;
        $rows['83']['herleitung'] = [
            ['account_code' => 'USt gesamt', 'account_name' => 'Kennziffer 81/86 Steuerbeträge', 'amount' => $outputTax, 'value_type' => 'tax_amount'],
            ['account_code' => 'Vorsteuer', 'account_name' => 'Kennziffer 66', 'amount' => -$inputTax, 'value_type' => 'tax_amount'],
        ];

        $totals = [
            'taxable_revenue_19' => $rows['81']['amount'],
            'taxable_revenue_7' => $rows['86']['amount'],
            'output_tax' => $outputTax,
            'input_tax' => $inputTax,
            'tax_payable' => $rows['83']['amount'],
        ];

        $quality = $this->quality->safeAssess('ustva', $period, $totals);
        foreach ($this->specialCaseBlockers($calculationPeriod, $mappingRows) as $blocker) {
            $quality['blocking_errors'][] = $blocker;
        }
        $quality['status'] = $quality['blocking_errors'] === [] ? (($quality['warnings'] ?? []) === [] ? 'ok' : 'warning') : 'error';

        $data = [
            'form_version' => $formVersion,
            'manual_transfer_notice' => 'Keine elektronische Abgabe. Werte manuell in Mein ELSTER eintragen.',
            'kennziffern' => array_values($rows),
        ];

        return $this->payload('ustva', $period, $data, $totals, $quality, [
            'kennziffern' => $data['kennziffern'],
            'tax_payable' => $totals['tax_payable'],
        ]);
    }

    /**
     * @param  Collection<int, mixed>  $mappingRows
     * @param  Collection<string, object>  $accountSums
     * @return array<string, array<string, mixed>>
     */
    private function mappedRows(Collection $mappingRows, Collection $accountSums): array
    {
        $rows = [];
        foreach ($this->mappings->kennziffern() as $kennziffer => $definition) {
            $rows[$kennziffer] = [
                'kennziffer' => $kennziffer,
                'label' => $definition['label'],
                'type' => $definition['type'],
                'order' => $definition['order'],
                'amount' => 0,
                'tax_amount' => 0,
                'herleitung' => [],
                'tax_herleitung' => [],
            ];
        }

        foreach ($mappingRows->where('source_type', 'account') as $mapping) {
            if (! isset($rows[$mapping->target_code])) {
                continue;
            }

            $account = $accountSums->get((string) $mapping->source_public_id);
            $amount = $this->mappedAmount($account, $mapping->value_type) * (int) $mapping->sign;
            if ($account === null || $amount === 0) {
                continue;
            }

            $derivation = [
                'account_code' => $account?->code,
                'account_name' => $account?->name,
                'amount' => $amount,
                'value_type' => $mapping->value_type,
            ];

            if ($mapping->value_type === 'tax_amount' && in_array($mapping->target_code, ['81', '86'], true)) {
                $rows[$mapping->target_code]['tax_amount'] += $amount;
                $rows[$mapping->target_code]['tax_herleitung'][] = $derivation;
            } else {
                $rows[$mapping->target_code]['amount'] += $amount;
                $rows[$mapping->target_code]['herleitung'][] = $derivation;
            }
        }

        uasort($rows, fn (array $a, array $b) => $a['order'] <=> $b['order']);

        return $rows;
    }

    private function mappedAmount(?object $row, string $valueType): int
    {
        if (! $row) {
            return 0;
        }

        $debit = (int) $row->debit;
        $credit = (int) $row->credit;

        return match ($valueType) {
            'debit' => $debit,
            'credit' => $credit,
            default => in_array($row->account_type, ['revenue', 'liability', 'equity'], true)
                ? $credit - $debit
                : $debit - $credit,
        };
    }

    /**
     * @return Collection<string, object>
     */
    private function accountSums(ReportPeriod $period): Collection
    {
        return DB::table('journal_entry_lines')
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
            ->join('accounts', 'accounts.id', '=', 'journal_entry_lines.account_id')
            ->whereNull('journal_entries.deleted_at')
            ->where('journal_entries.tenant_id', $this->queries->tenantId())
            ->where('accounts.tenant_id', $this->queries->tenantId())
            ->whereIn('journal_entries.status', $period->statuses())
            ->whereBetween('journal_entries.booking_date', [$period->from->toDateString(), $period->to->toDateString()])
            ->groupBy('accounts.public_id', 'accounts.code', 'accounts.name', 'accounts.type')
            ->orderBy('accounts.code')
            ->selectRaw("accounts.public_id, accounts.code, accounts.name, accounts.type as account_type, coalesce(sum(case when journal_entry_lines.type = 'debit' then journal_entry_lines.amount else 0 end), 0) as debit, coalesce(sum(case when journal_entry_lines.type = 'credit' then journal_entry_lines.amount else 0 end), 0) as credit")
            ->get()
            ->keyBy('public_id');
    }

    /**
     * @param  Collection<int, mixed>  $mappingRows
     * @return array<int, array<string, mixed>>
     */
    private function specialCaseBlockers(ReportPeriod $period, Collection $mappingRows): array
    {
        $blockers = [];
        $unsupportedTaxKeys = DB::table('journal_entry_lines')
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
            ->whereNull('journal_entries.deleted_at')
            ->where('journal_entries.tenant_id', $this->queries->tenantId())
            ->whereIn('journal_entries.status', $period->statuses())
            ->whereBetween('journal_entries.booking_date', [$period->from->toDateString(), $period->to->toDateString()])
            ->whereNotNull('journal_entry_lines.tax_key')
            ->whereNotIn('journal_entry_lines.tax_key', self::SUPPORTED_TAX_KEYS)
            ->selectRaw('journal_entry_lines.tax_key, count(*) as count')
            ->groupBy('journal_entry_lines.tax_key')
            ->get();

        if ($unsupportedTaxKeys->isNotEmpty()) {
            $blockers[] = [
                'code' => 'ustva_unsupported_tax_key',
                'severity' => 'error',
                'message' => 'Nicht unterstützte Steuerfälle gefunden (z.B. Reverse Charge oder innergemeinschaftliche Sachverhalte).',
                'affected_count' => (int) $unsupportedTaxKeys->sum('count'),
                'drilldown' => $unsupportedTaxKeys->map(fn (object $row) => ['tax_key' => $row->tax_key, 'count' => (int) $row->count])->values()->all(),
            ];
        }

        $mappedTaxAccountPublicIds = $mappingRows
            ->where('source_type', 'account')
            ->where('value_type', 'tax_amount')
            ->pluck('source_public_id')
            ->all();

        $unmappedTaxAccounts = $this->accountSums($period)
            ->filter(fn (object $row) => in_array($row->account_type, ['asset', 'liability'], true)
                && preg_match('/^(15|17)/', (string) $row->code)
                && ! in_array($row->public_id, $mappedTaxAccountPublicIds, true)
                && ((int) $row->debit !== 0 || (int) $row->credit !== 0))
            ->map(fn (object $row) => [
                'account_code' => $row->code,
                'account_name' => $row->name,
                'debit' => (int) $row->debit,
                'credit' => (int) $row->credit,
            ])
            ->values();

        if ($unmappedTaxAccounts->isNotEmpty()) {
            $blockers[] = [
                'code' => 'ustva_unmapped_tax_account',
                'severity' => 'error',
                'message' => 'Steuerkonto mit Bewegung ist keiner unterstützten USt-VA-Kennziffer zugeordnet.',
                'affected_count' => $unmappedTaxAccounts->count(),
                'drilldown' => $unmappedTaxAccounts->all(),
            ];
        }

        return $blockers;
    }

    private function tenant(): Tenant
    {
        $tenant = app('currentTenant');
        if (! $tenant instanceof Tenant) {
            $tenant = Tenant::findOrFail($this->queries->tenantId());
        }

        return $tenant;
    }
}
