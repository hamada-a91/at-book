<?php

namespace App\Modules\Accounting\Reports;

use App\Modules\Accounting\Reports\Concerns\BuildsReportPayload;

class JournalReport
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
        $rows = $this->queries->journalRows($period)->map(fn ($row) => [
            'entry_id' => (int) $row->entry_id,
            'entry_public_id' => $row->entry_public_id,
            'booking_date' => (string) $row->booking_date,
            'journal_number' => $row->journal_number,
            'beleg_number' => $row->journal_number ?: '#'.$row->entry_id,
            'description' => $row->description,
            'account_id' => (int) $row->account_id,
            'account_code' => $row->account_code,
            'account_name' => $row->account_name,
            'side' => $row->type,
            'debit' => $row->type === 'debit' ? (int) $row->amount : 0,
            'credit' => $row->type === 'credit' ? (int) $row->amount : 0,
            'amount' => (int) $row->amount,
            'status' => $row->status,
        ])->values()->all();

        $entries = collect($rows)->groupBy('entry_id')->map(function ($lines) {
            $first = $lines->first();

            return [
                'id' => $first['entry_id'],
                'public_id' => $first['entry_public_id'],
                'booking_date' => $first['booking_date'],
                'journal_number' => $first['journal_number'],
                'description' => $first['description'],
                'status' => $first['status'],
                'lines' => $lines->map(fn (array $line) => [
                    'id' => $line['entry_id'].'-'.$line['account_id'].'-'.$line['side'],
                    'type' => $line['side'],
                    'amount' => $line['amount'],
                    'account' => [
                        'id' => $line['account_id'],
                        'code' => $line['account_code'],
                        'name' => $line['account_name'],
                    ],
                ])->values()->all(),
            ];
        })->values()->all();

        $totals = [
            'debit' => array_sum(array_column($rows, 'debit')),
            'credit' => array_sum(array_column($rows, 'credit')),
            'line_count' => count($rows),
            'entry_count' => count($entries),
        ];

        return $this->payload('journal', $period, ['rows' => $rows, 'entries' => $entries], $totals, $this->quality->safeAssess('journal', $period, $totals), [
            'entries' => $entries,
        ]);
    }
}
