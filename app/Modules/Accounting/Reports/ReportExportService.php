<?php

namespace App\Modules\Accounting\Reports;

use App\Models\CompanySetting;
use Illuminate\Http\Response;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExportService
{
    /**
     * @param  array<string, mixed>  $report
     */
    public function pdf(array $report): Response
    {
        $pdf = app('dompdf.wrapper')->loadView('reports.pdf', [
            'report' => $report,
            'settings' => CompanySetting::query()->first(),
        ])->setPaper('a4', 'portrait');

        return $pdf->download($this->filename($report, 'pdf'));
    }

    /**
     * @param  array<string, mixed>  $report
     */
    public function csv(array $report): StreamedResponse
    {
        return response()->streamDownload(function () use ($report) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['report_type', $report['report_type']]);
            fputcsv($handle, ['basis', $report['basis']]);
            fputcsv($handle, ['from', $report['period']['from']]);
            fputcsv($handle, ['to', $report['period']['to']]);
            fputcsv($handle, []);

            foreach ($this->csvTables($report) as $table) {
                fputcsv($handle, [$table['title']]);
                fputcsv($handle, $table['headers']);
                foreach ($table['rows'] as $row) {
                    fputcsv($handle, $row);
                }
                fputcsv($handle, []);
            }

            fclose($handle);
        }, $this->filename($report, 'csv'), ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @param  array<string, mixed>  $report
     * @return array<int, array{title: string, headers: array<int, string>, rows: array<int, array<int, mixed>>}>
     */
    private function csvTables(array $report): array
    {
        return match ($report['report_type']) {
            'trial_balance' => [[
                'title' => 'Summen- und Saldenliste',
                'headers' => ['Konto', 'Name', 'Eröffnung', 'Perioden-Soll', 'Perioden-Haben', 'Schluss'],
                'rows' => array_map(fn (array $row) => [$row['code'], $row['name'], $row['opening_balance'], $row['period_debit'], $row['period_credit'], $row['closing_balance']], $report['data']),
            ]],
            'profit_loss' => [
                [
                    'title' => 'Erlöse',
                    'headers' => ['Konto', 'Name', 'Gruppe', 'Soll', 'Haben', 'Betrag'],
                    'rows' => array_map(fn (array $row) => [$row['code'], $row['name'], $row['group'], $row['debit'], $row['credit'], $row['amount']], $report['data']['revenues']),
                ],
                [
                    'title' => 'Aufwendungen',
                    'headers' => ['Konto', 'Name', 'Gruppe', 'Soll', 'Haben', 'Betrag'],
                    'rows' => array_map(fn (array $row) => [$row['code'], $row['name'], $row['group'], $row['debit'], $row['credit'], $row['amount']], $report['data']['expenses']),
                ],
            ],
            'balance_sheet' => [
                [
                    'title' => 'Aktiva',
                    'headers' => ['Konto', 'Name', 'Kategorie', 'Betrag', 'Aggregiert'],
                    'rows' => array_map(fn (array $row) => [$row['code'], $row['name'], $row['category'], $row['balance'], $row['is_aggregated'] ? 'ja' : 'nein'], $report['data']['assets']),
                ],
                [
                    'title' => 'Passiva',
                    'headers' => ['Konto', 'Name', 'Kategorie', 'Betrag', 'Aggregiert'],
                    'rows' => array_map(fn (array $row) => [$row['code'], $row['name'], $row['category'], $row['balance'], $row['is_aggregated'] ? 'ja' : 'nein'], array_merge($report['data']['equity'], $report['data']['liabilities'])),
                ],
            ],
            'journal' => [[
                'title' => 'Journal',
                'headers' => ['Datum', 'Journalnummer', 'Text', 'Konto', 'Soll', 'Haben', 'Status'],
                'rows' => array_map(fn (array $row) => [$row['booking_date'], $row['journal_number'], $row['description'], $row['account_code'].' '.$row['account_name'], $row['debit'], $row['credit'], $row['status']], $report['data']['rows']),
            ]],
            'account_movements' => [[
                'title' => 'Kontobewegungen',
                'headers' => ['Datum', 'Journalnummer', 'Text', 'Soll', 'Haben', 'Laufender Saldo', 'Status'],
                'rows' => array_map(fn (array $row) => [$row['booking_date'], $row['journal_number'], $row['description'], $row['debit'], $row['credit'], $row['running_balance'], $row['status']], $report['data']['movements']),
            ]],
            'vat' => [[
                'title' => 'USt-Bericht',
                'headers' => ['Steuerschlüssel', 'Art', 'Basis', 'Steuer', 'Anzahl'],
                'rows' => array_map(fn (array $row) => [$row['tax_key'], $row['bucket'], $row['base_amount'], $row['tax_amount'], $row['count']], $report['data']['groups']),
            ]],
            default => throw new InvalidArgumentException('Unbekannter Report-Typ.'),
        };
    }

    /**
     * @param  array<string, mixed>  $report
     */
    private function filename(array $report, string $format): string
    {
        return sprintf('%s_%s_%s.%s', $report['report_type'], $report['period']['from'], $report['period']['to'], $format);
    }
}
