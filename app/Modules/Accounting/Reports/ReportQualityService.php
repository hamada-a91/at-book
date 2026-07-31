<?php

namespace App\Modules\Accounting\Reports;

use App\Models\CompanySetting;
use Illuminate\Support\Facades\DB;
use Throwable;

class ReportQualityService
{
    public function __construct(private readonly ReportQueryService $queries) {}

    /**
     * @param  array<string, mixed>  $totals
     * @return array{status: string, warnings: array<int, array<string, mixed>>, blocking_errors: array<int, array<string, mixed>>}
     */
    public function assess(string $reportType, ReportPeriod $period, array $totals = []): array
    {
        $warnings = [];
        $blocking = [];

        if ($period->basis === ReportPeriod::BASIS_PREVIEW) {
            $warnings[] = $this->finding('preview_basis', 'warning', 'Vorschau enthält Entwürfe und ist nicht zur Abgabe geeignet.', 1);
        }

        $entrySums = DB::table('journal_entries')
            ->leftJoin('journal_entry_lines', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
            ->whereNull('journal_entries.deleted_at')
            ->where('journal_entries.tenant_id', $this->queries->tenantId())
            ->whereIn('journal_entries.status', $period->statuses())
            ->whereBetween('journal_entries.booking_date', [$period->from->toDateString(), $period->to->toDateString()])
            ->groupBy('journal_entries.id')
            ->selectRaw("journal_entries.id, coalesce(sum(case when journal_entry_lines.type = 'debit' then journal_entry_lines.amount else 0 end), 0) as debit, coalesce(sum(case when journal_entry_lines.type = 'credit' then journal_entry_lines.amount else 0 end), 0) as credit");

        $imbalancedEntries = DB::query()
            ->fromSub($entrySums, 'entry_sums')
            ->whereColumn('debit', '!=', 'credit')
            ->count();

        if ($imbalancedEntries > 0) {
            $blocking[] = $this->finding('entry_debit_credit_mismatch', 'error', 'Mindestens eine Buchung ist nicht Soll/Haben-gleich.', $imbalancedEntries);
        }

        $totalDebit = (int) ($totals['total_debit'] ?? $totals['debit'] ?? 0);
        $totalCredit = (int) ($totals['total_credit'] ?? $totals['credit'] ?? 0);
        if (($totalDebit !== 0 || $totalCredit !== 0) && $totalDebit !== $totalCredit && $reportType === 'trial_balance') {
            $blocking[] = $this->finding('period_debit_credit_mismatch', 'error', 'Die Periodensummen Soll und Haben sind nicht gleich.', 1);
        }

        $missingAccounts = DB::table('journal_entry_lines')
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
            ->leftJoin('accounts', 'accounts.id', '=', 'journal_entry_lines.account_id')
            ->whereNull('journal_entries.deleted_at')
            ->where('journal_entries.tenant_id', $this->queries->tenantId())
            ->whereIn('journal_entries.status', $period->statuses())
            ->whereBetween('journal_entries.booking_date', [$period->from->toDateString(), $period->to->toDateString()])
            ->whereNull('accounts.id')
            ->count();

        if ($missingAccounts > 0) {
            $blocking[] = $this->finding('missing_account_reference', 'error', 'Buchungszeilen mit fehlendem Kontenbezug gefunden.', $missingAccounts);
        }

        if ($reportType === 'balance_sheet') {
            $difference = (int) ($totals['difference'] ?? 0);
            if ($difference !== 0) {
                $warnings[] = $this->finding('balance_sheet_difference', 'warning', 'Aktiva und Passiva sind nicht ausgeglichen.', 1);
            }
        }

        if (in_array($reportType, ['vat', 'ustva'], true) && $period->basis !== ReportPeriod::BASIS_POSTED) {
            $blocking[] = $this->finding('vat_requires_posted_basis', 'error', 'Steuerberichte sind nur mit basis=posted zulässig.', 1);
        }

        if ($reportType === 'ustva') {
            $draftEntries = DB::table('journal_entries')
                ->whereNull('journal_entries.deleted_at')
                ->where('journal_entries.tenant_id', $this->queries->tenantId())
                ->where('journal_entries.status', 'draft')
                ->whereBetween('journal_entries.booking_date', [$period->from->toDateString(), $period->to->toDateString()])
                ->count();

            if ($draftEntries > 0) {
                $blocking[] = $this->finding('ustva_open_drafts', 'error', 'Im Zeitraum liegen Entwürfe. Der Übertragungsbogen ist erst nach Festschreibung zulässig.', $draftEntries);
            }

            $settings = CompanySetting::query()->first();
            if ($settings && (! $settings->books_locked_until || $settings->books_locked_until->lt($period->to))) {
                $warnings[] = $this->finding('ustva_period_not_locked', 'warning', 'Die Periode ist noch nicht vollständig festgeschrieben.', 1);
            }

            if (! $settings || blank($settings->tax_number)) {
                $warnings[] = $this->finding('missing_tax_number', 'warning', 'Steuernummer fehlt in den Firmendaten.', 1);
            }
        }

        if (! CompanySetting::query()->exists()) {
            $warnings[] = $this->finding('missing_company_settings', 'warning', 'Firmendaten fehlen oder sind unvollständig.', 1);
        }

        return [
            'status' => $blocking === [] ? ($warnings === [] ? 'ok' : 'warning') : 'error',
            'warnings' => $warnings,
            'blocking_errors' => $blocking,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function safeAssess(string $reportType, ReportPeriod $period, array $totals = []): array
    {
        try {
            return $this->assess($reportType, $period, $totals);
        } catch (Throwable $e) {
            return [
                'status' => 'error',
                'warnings' => [],
                'blocking_errors' => [
                    $this->finding('quality_check_failed', 'error', 'Datenqualitätsprüfung konnte nicht ausgeführt werden.', 1),
                ],
            ];
        }
    }

    /**
     * @return array{code: string, severity: string, message: string, affected_count: int}
     */
    private function finding(string $code, string $severity, string $message, int $affectedCount): array
    {
        return [
            'code' => $code,
            'severity' => $severity,
            'message' => $message,
            'affected_count' => $affectedCount,
        ];
    }
}
