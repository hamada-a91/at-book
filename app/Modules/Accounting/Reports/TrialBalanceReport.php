<?php

namespace App\Modules\Accounting\Reports;

use App\Modules\Accounting\Reports\Concerns\BuildsReportPayload;

class TrialBalanceReport
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
        $opening = $this->queries->accountOpeningSums($period);
        $rows = $this->queries->accountPeriodSums($period)->map(function ($row) use ($opening) {
            $openingRow = $opening->get($row->account_id);
            $openingDebit = (int) ($openingRow->debit ?? 0);
            $openingCredit = (int) ($openingRow->credit ?? 0);
            $openingBalance = $this->normalBalance((string) $row->account_type, $openingDebit, $openingCredit);
            $periodDebit = (int) $row->debit;
            $periodCredit = (int) $row->credit;
            $closingBalance = $this->normalBalance((string) $row->account_type, $openingDebit + $periodDebit, $openingCredit + $periodCredit);

            return [
                'account_id' => (int) $row->account_id,
                'code' => $row->code,
                'name' => $row->name,
                'type' => $row->account_type,
                'opening_balance' => $openingBalance,
                'period_debit' => $periodDebit,
                'period_credit' => $periodCredit,
                'closing_balance' => $closingBalance,
                'closing_debit' => $closingBalance > 0 ? $closingBalance : 0,
                'closing_credit' => $closingBalance < 0 ? abs($closingBalance) : 0,
                'total_debit' => $periodDebit,
                'total_credit' => $periodCredit,
                'balance' => $periodDebit - $periodCredit,
            ];
        })->filter(fn (array $row) => $row['opening_balance'] !== 0 || $row['period_debit'] !== 0 || $row['period_credit'] !== 0)->values()->all();

        $totals = [
            'opening_balance' => array_sum(array_column($rows, 'opening_balance')),
            'period_debit' => array_sum(array_column($rows, 'period_debit')),
            'period_credit' => array_sum(array_column($rows, 'period_credit')),
            'closing_balance' => array_sum(array_column($rows, 'closing_balance')),
            'debit' => array_sum(array_column($rows, 'period_debit')),
            'credit' => array_sum(array_column($rows, 'period_credit')),
        ];
        $totals['is_balanced'] = $totals['period_debit'] === $totals['period_credit'];

        return $this->payload('trial_balance', $period, $rows, $totals, $this->quality->safeAssess('trial_balance', $period, $totals));
    }

    private function normalBalance(string $accountType, int $debit, int $credit): int
    {
        return in_array($accountType, ['asset', 'expense'], true)
            ? $debit - $credit
            : $credit - $debit;
    }
}
