<?php

namespace App\Modules\Accounting\Reports;

use App\Modules\Accounting\Reports\Concerns\BuildsReportPayload;

class ProfitLossReport
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
        $rows = $this->queries->accountPeriodSums($period);

        $revenues = $rows->where('account_type', 'revenue')->map(function ($row) {
            $debit = (int) $row->debit;
            $credit = (int) $row->credit;
            $amount = $credit - $debit;

            return [
                'code' => $row->code,
                'name' => $row->name,
                'group' => $row->category ?: 'Erlöse',
                'debit' => $debit,
                'credit' => $credit,
                'amount' => $amount,
                'balance_type' => $amount >= 0 ? 'credit' : 'debit',
            ];
        })->filter(fn (array $row) => $row['debit'] !== 0 || $row['credit'] !== 0)->values()->all();

        $expenses = $rows->where('account_type', 'expense')->map(function ($row) {
            $debit = (int) $row->debit;
            $credit = (int) $row->credit;
            $amount = $debit - $credit;

            return [
                'code' => $row->code,
                'name' => $row->name,
                'group' => $row->category ?: 'Aufwendungen',
                'debit' => $debit,
                'credit' => $credit,
                'amount' => $amount,
                'balance_type' => $amount >= 0 ? 'debit' : 'credit',
            ];
        })->filter(fn (array $row) => $row['debit'] !== 0 || $row['credit'] !== 0)->values()->all();

        $totals = [
            'revenue' => array_sum(array_column($revenues, 'amount')),
            'expense' => array_sum(array_column($expenses, 'amount')),
        ];
        $totals['net_profit'] = $totals['revenue'] - $totals['expense'];

        return $this->payload('profit_loss', $period, [
            'revenues' => $revenues,
            'expenses' => $expenses,
        ], $totals, $this->quality->safeAssess('profit_loss', $period, $totals), [
            'revenues' => $revenues,
            'expenses' => $expenses,
            'total_revenue' => $totals['revenue'],
            'total_expense' => $totals['expense'],
            'net_profit' => $totals['net_profit'],
        ]);
    }
}
