<?php

namespace App\Modules\Accounting\Reports;

use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Reports\Concerns\BuildsReportPayload;
use InvalidArgumentException;

class AccountMovementsReport
{
    use BuildsReportPayload;

    public function __construct(
        private readonly ReportQueryService $queries,
        private readonly ReportQualityService $quality,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function generate(ReportPeriod $period, ?int $accountId): array
    {
        if (! $accountId) {
            throw new InvalidArgumentException('account_id ist erforderlich.');
        }

        $account = Account::query()->findOrFail($accountId);
        $openingRows = $this->queries->accountOpeningSums($period);
        $openingRow = $openingRows->get($account->id);
        $openingBalance = $this->normalBalance($account->type, (int) ($openingRow->debit ?? 0), (int) ($openingRow->credit ?? 0));
        $runningBalance = $openingBalance;

        $movements = $this->queries->accountMovementRows($period, $account->id)->map(function ($row) use (&$runningBalance, $account) {
            $signed = in_array($account->type, ['asset', 'expense'], true)
                ? ($row->type === 'debit' ? (int) $row->amount : -((int) $row->amount))
                : ($row->type === 'credit' ? (int) $row->amount : -((int) $row->amount));
            $runningBalance += $signed;

            return [
                'entry_id' => (int) $row->entry_id,
                'entry_public_id' => $row->entry_public_id,
                'booking_date' => (string) $row->booking_date,
                'journal_number' => $row->journal_number,
                'description' => $row->description,
                'side' => $row->type,
                'debit' => $row->type === 'debit' ? (int) $row->amount : 0,
                'credit' => $row->type === 'credit' ? (int) $row->amount : 0,
                'amount' => (int) $row->amount,
                'running_balance' => $runningBalance,
                'status' => $row->status,
            ];
        })->values()->all();

        $totals = [
            'opening_balance' => $openingBalance,
            'debit' => array_sum(array_column($movements, 'debit')),
            'credit' => array_sum(array_column($movements, 'credit')),
            'closing_balance' => $runningBalance,
        ];

        return $this->payload('account_movements', $period, [
            'account' => $account->only(['id', 'public_id', 'code', 'name', 'type']),
            'movements' => $movements,
        ], $totals, $this->quality->safeAssess('account_movements', $period, $totals), [
            'account' => $account,
            'opening_balance' => $openingBalance,
            'movements' => $movements,
            'closing_balance' => $runningBalance,
        ]);
    }

    private function normalBalance(string $accountType, int $debit, int $credit): int
    {
        return in_array($accountType, ['asset', 'expense'], true)
            ? $debit - $credit
            : $credit - $debit;
    }
}
