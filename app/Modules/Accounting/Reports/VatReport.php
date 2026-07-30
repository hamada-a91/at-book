<?php

namespace App\Modules\Accounting\Reports;

use App\Modules\Accounting\Reports\Concerns\BuildsReportPayload;

class VatReport
{
    use BuildsReportPayload;

    public function __construct(
        private readonly ReportQueryService $queries,
        private readonly ReportQualityService $quality,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function generate(ReportPeriod $period): array
    {
        $groups = $this->queries->vatRows($period)->map(function ($row) {
            $taxKey = (string) $row->tax_key;
            $taxAmount = (int) $row->tax_amount;
            $bucket = str_starts_with($taxKey, 'VST') || str_contains($taxKey, 'VOR') || $row->account_type === 'expense'
                ? 'input_tax'
                : 'output_tax';

            return [
                'tax_key' => $taxKey,
                'account_type' => $row->account_type,
                'bucket' => $bucket,
                'base_amount' => (int) $row->base_amount,
                'tax_amount' => $taxAmount,
                'count' => (int) $row->count,
            ];
        })->values()->all();

        $outputTax = array_sum(array_map(fn (array $row) => $row['bucket'] === 'output_tax' ? $row['tax_amount'] : 0, $groups));
        $inputTax = array_sum(array_map(fn (array $row) => $row['bucket'] === 'input_tax' ? $row['tax_amount'] : 0, $groups));
        $totals = [
            'output_tax' => $outputTax,
            'input_tax' => $inputTax,
            'tax_payable' => $outputTax - $inputTax,
            'total_tax_amount' => $outputTax + $inputTax,
        ];

        $taxSummary = collect($groups)->groupBy('tax_key')->map(fn ($items, $key) => [
            'tax_key' => $key,
            'base_amount' => $items->sum('base_amount'),
            'tax_amount' => $items->sum('tax_amount'),
            'count' => $items->sum('count'),
        ])->all();

        return $this->payload('vat', $period, [
            'groups' => $groups,
            'tax_summary' => $taxSummary,
        ], $totals, $this->quality->safeAssess('vat', $period, $totals), [
            'tax_summary' => $taxSummary,
            'total_tax_amount' => $totals['total_tax_amount'],
        ]);
    }
}
