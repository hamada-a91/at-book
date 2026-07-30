<?php

namespace App\Modules\Accounting\Reports;

use App\Modules\Accounting\Reports\Concerns\BuildsReportPayload;

class BalanceSheetReport
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
        $rows = $this->queries->balanceSums($period);

        $assets = [];
        $liabilities = [];
        $equity = [];
        $debtorTotal = 0;
        $debtorCount = 0;
        $creditorTotal = 0;
        $creditorCount = 0;

        foreach ($rows as $row) {
            $code = (string) $row->code;
            $debit = (int) $row->debit;
            $credit = (int) $row->credit;

            if ($code >= '10000' && $code <= '19999') {
                $debtorTotal += $debit - $credit;
                $debtorCount++;

                continue;
            }

            if ($code >= '70000' && $code <= '79999') {
                $creditorTotal += $credit - $debit;
                $creditorCount++;

                continue;
            }

            $balance = in_array($row->account_type, ['asset', 'expense'], true) ? $debit - $credit : $credit - $debit;
            if ($balance === 0) {
                continue;
            }

            $target = [
                'code' => $code,
                'name' => $row->name,
                'category' => $row->category,
                'balance' => $balance,
                'is_aggregated' => false,
            ];

            if ($row->account_type === 'asset') {
                $assets[] = $target;
            } elseif ($row->account_type === 'liability') {
                $liabilities[] = $target;
            } elseif ($row->account_type === 'equity') {
                $equity[] = $target;
            }
        }

        if ($debtorTotal !== 0) {
            $assets[] = [
                'code' => '1400',
                'name' => 'Forderungen aus Lieferungen und Leistungen',
                'category' => 'Umlaufvermögen',
                'balance' => $debtorTotal,
                'is_aggregated' => true,
                'detail_count' => $debtorCount,
            ];
        }

        if ($creditorTotal !== 0) {
            $liabilities[] = [
                'code' => '1600',
                'name' => 'Verbindlichkeiten aus Lieferungen und Leistungen',
                'category' => 'Verbindlichkeiten',
                'balance' => $creditorTotal,
                'is_aggregated' => true,
                'detail_count' => $creditorCount,
            ];
        }

        $totals = [
            'assets' => array_sum(array_column($assets, 'balance')),
            'liabilities' => array_sum(array_column($liabilities, 'balance')),
            'equity' => array_sum(array_column($equity, 'balance')),
        ];
        $totals['passiva'] = $totals['liabilities'] + $totals['equity'];
        $totals['difference'] = $totals['assets'] - $totals['passiva'];
        $totals['is_balanced'] = $totals['difference'] === 0;

        return $this->payload('balance_sheet', $period, [
            'as_of' => $period->to->toDateString(),
            'assets' => $assets,
            'liabilities' => $liabilities,
            'equity' => $equity,
        ], $totals, $this->quality->safeAssess('balance_sheet', $period, $totals), [
            'as_of' => $period->to->toDateString(),
            'assets' => $assets,
            'liabilities' => $liabilities,
            'equity' => $equity,
            'total_assets' => $totals['assets'],
            'total_liabilities' => $totals['liabilities'],
            'total_equity' => $totals['equity'],
            'calculated_profit_loss' => $totals['difference'],
        ]);
    }
}
