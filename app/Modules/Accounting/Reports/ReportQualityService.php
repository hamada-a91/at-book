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
            $draftBookings = $this->draftBookingCount($period);
            if ($draftBookings > 0) {
                $warnings[] = $this->finding('preview_basis', 'warning', 'Vorschau enthält '.$draftBookings.' Buchungs-Entwürfe und ist nicht zur Abgabe geeignet.', $draftBookings);
            }
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

        // Vollständigkeitshinweis: nicht gebuchte Belege/Rechnungen (Entwürfe) im Zeitraum
        // tauchen mangels Buchung in KEINER Auswertung auf. Nur eine Warnung - Entwürfe
        // können legitim in einen anderen Zeitraum gehören -, aber wichtig, damit keine
        // unvollständige USt-VA/BWA/GuV entsteht.
        if (in_array($reportType, ['ustva', 'bwa', 'profit_loss'], true)) {
            $unbooked = $this->unbookedDocumentCounts($period);
            if ($unbooked['total'] > 0) {
                $warnings[] = [
                    'code' => 'unbooked_documents',
                    'severity' => 'warning',
                    'message' => 'Im Zeitraum liegen '.$unbooked['total'].' nicht gebuchte Belege/Rechnungen (Entwürfe). Prüfen, ob sie zur Auswertung gehören und noch gebucht werden müssen.',
                    'affected_count' => $unbooked['total'],
                    'drilldown' => [
                        ['type' => 'belege', 'count' => $unbooked['belege']],
                        ['type' => 'invoices', 'count' => $unbooked['invoices']],
                    ],
                ];
            }
        }

        if ($reportType === 'ustva') {
            $draftEntries = $this->draftBookingCount($period);

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
     * Anzahl der Buchungs-Entwürfe (journal_entries.status='draft') im Zeitraum.
     * Basis der Vorschau- und USt-VA-Entwurfsprüfungen - bewusst NICHT identisch mit
     * Beleg-/Rechnungs-Entwürfen (die sind ungebucht, siehe unbookedDocumentCounts()).
     */
    private function draftBookingCount(ReportPeriod $period): int
    {
        return DB::table('journal_entries')
            ->whereNull('deleted_at')
            ->where('tenant_id', $this->queries->tenantId())
            ->where('status', 'draft')
            ->whereBetween('booking_date', [$period->from->toDateString(), $period->to->toDateString()])
            ->count();
    }

    /**
     * Nicht gebuchte Belege/Rechnungen (Status 'draft', ohne Journalbuchung) im Zeitraum.
     * belege datiert über document_date (soft-deletes), invoices über invoice_date
     * (keine soft-deletes).
     *
     * @return array{belege: int, invoices: int, total: int}
     */
    private function unbookedDocumentCounts(ReportPeriod $period): array
    {
        $tenantId = $this->queries->tenantId();
        $from = $period->from->toDateString();
        $to = $period->to->toDateString();

        $belege = DB::table('belege')
            ->whereNull('deleted_at')
            ->where('tenant_id', $tenantId)
            ->where('status', 'draft')
            ->whereBetween('document_date', [$from, $to])
            ->count();

        $invoices = DB::table('invoices')
            ->where('tenant_id', $tenantId)
            ->where('status', 'draft')
            ->whereBetween('invoice_date', [$from, $to])
            ->count();

        return ['belege' => $belege, 'invoices' => $invoices, 'total' => $belege + $invoices];
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
