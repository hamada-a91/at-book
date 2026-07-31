<?php

namespace App\Modules\Accounting\Reports;

use App\Models\Tenant;
use App\Modules\Accounting\Reports\Bwa\BwaMappingService;
use App\Modules\Accounting\Reports\Concerns\BuildsReportPayload;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BwaReport
{
    use BuildsReportPayload;

    public function __construct(
        private readonly BwaMappingService $mappings,
        private readonly ReportQueryService $queries,
        private readonly ReportQualityService $quality,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function generate(ReportPeriod $period): array
    {
        $tenant = $this->tenant();
        $formVersion = BwaMappingService::FORM_VERSION;
        $mappingRows = $this->mappings->mappings($tenant, $formVersion);

        $periodSums = $this->accountSums($period, $period->from, $period->to);
        $yearToDateSums = $this->accountSums($period, $period->to->startOfYear(), $period->to);
        $previousPeriodSums = $this->accountSums($period, $period->from->subYear(), $period->to->subYear());

        $mappedRows = $this->mappedRows($mappingRows, $periodSums, $yearToDateSums, $previousPeriodSums);
        $rows = $this->withCalculatedRows($mappedRows);

        $totals = [
            'revenue' => $rows['revenue']['month_value'] ?? 0,
            'costs' => $this->costTotal($rows, 'month_value'),
            'gross_profit' => $rows['gross_profit']['month_value'] ?? 0,
            'operating_result' => $rows['operating_result']['month_value'] ?? 0,
            'mapped_accounts' => $mappingRows->where('source_type', 'account')->pluck('source_public_id')->unique()->count(),
        ];

        $unmappedAccounts = $this->unmappedActiveAccounts($period, $mappingRows);
        $totals['unmapped_active_accounts'] = count($unmappedAccounts);

        $quality = $this->quality->safeAssess('bwa', $period, $totals);
        if ($unmappedAccounts !== []) {
            $quality['warnings'][] = [
                'code' => 'bwa_unmapped_active_accounts',
                'severity' => 'warning',
                'message' => 'Aktive GuV-Konten mit Bewegung sind keiner BWA-Zeile zugeordnet.',
                'affected_count' => count($unmappedAccounts),
                'drilldown' => $unmappedAccounts,
            ];
            if (($quality['status'] ?? 'ok') === 'ok') {
                $quality['status'] = 'warning';
            }
        }

        $data = [
            'form_version' => $formVersion,
            'comparison_period' => [
                'from' => $period->from->subYear()->toDateString(),
                'to' => $period->to->subYear()->toDateString(),
            ],
            'year_to_date_period' => [
                'from' => $period->to->startOfYear()->toDateString(),
                'to' => $period->to->toDateString(),
            ],
            'rows' => array_values($rows),
        ];

        return $this->payload('bwa', $period, $data, $totals, $quality, [
            'rows' => $data['rows'],
            'form_version' => $formVersion,
        ]);
    }

    /**
     * @param  Collection<int, mixed>  $mappingRows
     * @param  Collection<string, object>  $periodSums
     * @param  Collection<string, object>  $yearToDateSums
     * @param  Collection<string, object>  $previousPeriodSums
     * @return array<string, array<string, mixed>>
     */
    private function mappedRows(Collection $mappingRows, Collection $periodSums, Collection $yearToDateSums, Collection $previousPeriodSums): array
    {
        $lineDefinitions = $this->mappings->lines();
        $rows = [];

        foreach ($lineDefinitions as $code => $definition) {
            $rows[$code] = [
                'code' => $code,
                'label' => $definition['label'],
                'type' => $definition['type'],
                'order' => $definition['order'],
                'month_value' => 0,
                'year_to_date_value' => 0,
                'previous_year_value' => 0,
                'deviation_amount' => 0,
                'deviation_percent' => null,
                'accounts' => [],
            ];
        }

        foreach ($mappingRows->where('source_type', 'account') as $mapping) {
            if (! isset($rows[$mapping->target_code])) {
                continue;
            }

            $publicId = (string) $mapping->source_public_id;
            $periodAmount = $this->mappedAmount($periodSums->get($publicId), $mapping->value_type) * (int) $mapping->sign;
            $yearToDateAmount = $this->mappedAmount($yearToDateSums->get($publicId), $mapping->value_type) * (int) $mapping->sign;
            $previousAmount = $this->mappedAmount($previousPeriodSums->get($publicId), $mapping->value_type) * (int) $mapping->sign;

            $rows[$mapping->target_code]['month_value'] += $periodAmount;
            $rows[$mapping->target_code]['year_to_date_value'] += $yearToDateAmount;
            $rows[$mapping->target_code]['previous_year_value'] += $previousAmount;

            $accountRow = $periodSums->get($publicId) ?? $yearToDateSums->get($publicId) ?? $previousPeriodSums->get($publicId);
            $rows[$mapping->target_code]['accounts'][] = [
                'public_id' => $publicId,
                'code' => $accountRow?->code,
                'name' => $accountRow?->name,
                'month_value' => $periodAmount,
                'year_to_date_value' => $yearToDateAmount,
                'previous_year_value' => $previousAmount,
            ];
        }

        foreach ($rows as &$row) {
            $row['deviation_amount'] = $row['month_value'] - $row['previous_year_value'];
            $row['deviation_percent'] = $row['previous_year_value'] === 0
                ? null
                : round($row['deviation_amount'] / abs($row['previous_year_value']) * 100, 2);
        }
        unset($row);

        return $rows;
    }

    /**
     * @param  array<string, array<string, mixed>>  $rows
     * @return array<string, array<string, mixed>>
     */
    private function withCalculatedRows(array $rows): array
    {
        $rows['gross_profit'] = $this->calculatedRow($rows['gross_profit'], [
            $rows['revenue'],
            $this->negative($rows['material']),
        ]);

        $rows['operating_result'] = $this->calculatedRow($rows['operating_result'], [
            $rows['gross_profit'],
            $this->negative($rows['personnel']),
            $this->negative($rows['room']),
            $this->negative($rows['insurance']),
            $this->negative($rows['vehicle']),
            $this->negative($rows['advertising_travel']),
            $this->negative($rows['depreciation']),
            $this->negative($rows['other_costs']),
        ]);

        uasort($rows, fn (array $a, array $b) => $a['order'] <=> $b['order']);

        return $rows;
    }

    /**
     * @param  array<string, mixed>  $base
     * @param  array<int, array<string, mixed>>  $parts
     * @return array<string, mixed>
     */
    private function calculatedRow(array $base, array $parts): array
    {
        foreach (['month_value', 'year_to_date_value', 'previous_year_value'] as $field) {
            $base[$field] = array_sum(array_column($parts, $field));
        }

        $base['deviation_amount'] = $base['month_value'] - $base['previous_year_value'];
        $base['deviation_percent'] = $base['previous_year_value'] === 0
            ? null
            : round($base['deviation_amount'] / abs($base['previous_year_value']) * 100, 2);
        $base['accounts'] = [];

        return $base;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function negative(array $row): array
    {
        foreach (['month_value', 'year_to_date_value', 'previous_year_value'] as $field) {
            $row[$field] *= -1;
        }

        return $row;
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
    private function accountSums(ReportPeriod $period, CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return DB::table('journal_entry_lines')
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
            ->join('accounts', 'accounts.id', '=', 'journal_entry_lines.account_id')
            ->whereNull('journal_entries.deleted_at')
            ->where('journal_entries.tenant_id', $this->queries->tenantId())
            ->whereIn('journal_entries.status', $period->statuses())
            ->whereBetween('journal_entries.booking_date', [$from->toDateString(), $to->toDateString()])
            ->whereIn('accounts.type', ['revenue', 'expense'])
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
    private function unmappedActiveAccounts(ReportPeriod $period, Collection $mappingRows): array
    {
        $mappedPublicIds = $mappingRows->where('source_type', 'account')->pluck('source_public_id')->all();

        return $this->accountSums($period, $period->from, $period->to)
            ->filter(fn (object $row) => ! in_array($row->public_id, $mappedPublicIds, true) && ((int) $row->debit !== 0 || (int) $row->credit !== 0))
            ->map(fn (object $row) => [
                'public_id' => $row->public_id,
                'code' => $row->code,
                'name' => $row->name,
                'type' => $row->account_type,
            ])
            ->values()
            ->all();
    }

    /**
     * @param  array<string, array<string, mixed>>  $rows
     */
    private function costTotal(array $rows, string $field): int
    {
        return array_sum(array_map(
            fn (string $code) => $rows[$code][$field] ?? 0,
            ['material', 'personnel', 'room', 'insurance', 'vehicle', 'advertising_travel', 'depreciation', 'other_costs']
        ));
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
