<?php

namespace App\Modules\Projects\Services;

use App\Models\Beleg;
use App\Modules\Accounting\Models\JournalEntryLine;
use App\Modules\Projects\Models\CostCenter;
use App\Modules\Projects\Models\Project;
use Carbon\Carbon;

/**
 * SPEC-08: Auswertungen für eine einzelne Kosten-Dimension (Kostenträger eines
 * Projekts ODER Kostenstelle) - liefert reine PHP-Arrays (Controller rendert
 * JSON/PDF).
 *
 * WICHTIG (Reports-Prinzip, siehe CLAUDE.md/ReportsController-Docblock):
 * Auswertungen werden NIE mit `status != cancelled` gefiltert - `posted` UND
 * `cancelled` fließen beide ein, Storno-Paare (Original + Generalumkehr)
 * neutralisieren sich zu 0. `draft`-Buchungen sind noch nicht festgeschrieben
 * und fließen NICHT ein.
 *
 * Netto/USt/Brutto-Ableitung pro Kostenbuchung: journal_entry_lines.amount ist
 * NETTO; die USt steht als eigene Buchungszeile auf einem USt-/Vorsteuerkonto.
 * Damit der Kosten-Nachweis Netto/USt/Brutto PRO Zeile ausweisen kann, wird das
 * Feld journal_entry_lines.tax_amount zusätzlich auf der Aufwands-/Erlöszeile
 * selbst informativ mitgeschrieben (siehe InvoiceBookingService/BelegController).
 * Für Alt-Buchungen ohne tax_amount ist ust=0.
 */
class ProjectReportService
{
    /** Buchungsstatus, die als "festgeschrieben" gelten. */
    private const POSTED_STATUSES = ['posted', 'cancelled'];

    // ===================== Öffentliche Einstiegspunkte =====================

    public function summary(Project $project): array
    {
        $base = $this->summaryForDimension('cost_object_id', $project->cost_object_id, $project->budget_amount);

        return array_merge([
            'project_id' => $project->id,
            'project_number' => $project->number,
            'project_name' => $project->name,
            'open_belege_count' => Beleg::where('project_id', $project->id)->where('status', 'draft')->count(),
        ], $base);
    }

    public function costReport(Project $project, ?string $from = null, ?string $to = null): array
    {
        return array_merge(
            ['project_id' => $project->id],
            $this->costReportForDimension('cost_object_id', $project->cost_object_id, $from, $to)
        );
    }

    public function costCenterSummary(CostCenter $costCenter): array
    {
        // Kostenstellen haben kein eigenes Budget/Belege -> nur die Kern-KPIs.
        return array_merge([
            'cost_center_id' => $costCenter->id,
            'code' => $costCenter->code,
            'name' => $costCenter->name,
        ], $this->summaryForDimension('cost_center_id', $costCenter->id, null));
    }

    public function costCenterCostReport(CostCenter $costCenter, ?string $from = null, ?string $to = null): array
    {
        return array_merge(
            ['cost_center_id' => $costCenter->id],
            $this->costReportForDimension('cost_center_id', $costCenter->id, $from, $to)
        );
    }

    // ===================== Dimensions-agnostische Kernlogik =====================

    /**
     * KPIs + Berichts-Daten (Kosten je Konto, Monatsverlauf) für eine Dimension.
     */
    private function summaryForDimension(string $column, int $dimensionId, ?int $budgetAmount): array
    {
        $lines = JournalEntryLine::with(['account', 'journalEntry'])
            ->where($column, $dimensionId)
            ->whereHas('journalEntry', fn ($q) => $q->whereIn('status', self::POSTED_STATUSES))
            ->get();

        $revenue = 0;
        $cost = 0;
        $costByAccount = [];   // account_code => [name, amount]
        $monthly = [];         // 'YYYY-MM' => [revenue, cost]

        foreach ($lines as $line) {
            $type = $line->account?->type;
            $month = Carbon::parse($line->journalEntry->booking_date)->format('Y-m');
            $monthly[$month] ??= ['month' => $month, 'revenue' => 0, 'cost' => 0];

            if ($type === 'revenue') {
                $delta = ($line->type === 'credit' ? 1 : -1) * (int) $line->amount;
                $revenue += $delta;
                $monthly[$month]['revenue'] += $delta;
            } elseif ($type === 'expense') {
                $delta = ($line->type === 'debit' ? 1 : -1) * (int) $line->amount;
                $cost += $delta;
                $monthly[$month]['cost'] += $delta;

                $code = $line->account?->code ?? '—';
                $costByAccount[$code] ??= ['account_code' => $code, 'account_name' => $line->account?->name, 'amount' => 0];
                $costByAccount[$code]['amount'] += $delta;
            }
        }

        ksort($monthly);
        $costByAccount = array_values(array_filter($costByAccount, fn ($r) => $r['amount'] !== 0));
        usort($costByAccount, fn ($a, $b) => $b['amount'] <=> $a['amount']);

        $budgetUsedPct = ($budgetAmount !== null && $budgetAmount > 0)
            ? round(($cost / $budgetAmount) * 100, 1)
            : null;

        return [
            'revenue' => $revenue,
            'cost' => $cost,
            'profit' => $revenue - $cost,
            'budget_amount' => $budgetAmount,
            'budget_used_pct' => $budgetUsedPct,
            'cost_by_account' => $costByAccount,
            'monthly' => array_values($monthly),
        ];
    }

    /**
     * Kosten-Nachweis (expense-Zeilen der Dimension) mit Netto/USt/Brutto + Summe.
     */
    private function costReportForDimension(string $column, int $dimensionId, ?string $from, ?string $to): array
    {
        $lines = JournalEntryLine::with(['account', 'journalEntry.beleg'])
            ->where($column, $dimensionId)
            ->whereHas('account', fn ($q) => $q->where('type', 'expense'))
            ->whereHas('journalEntry', function ($q) use ($from, $to) {
                $q->whereIn('status', self::POSTED_STATUSES);
                if ($from) {
                    $q->whereDate('booking_date', '>=', $from);
                }
                if ($to) {
                    $q->whereDate('booking_date', '<=', $to);
                }
            })
            ->get()
            ->sortBy(fn (JournalEntryLine $line) => $line->journalEntry->booking_date.'-'.$line->journalEntry->id)
            ->values();

        $reportLines = [];
        $totalNetto = 0;
        $totalUst = 0;

        foreach ($lines as $line) {
            // Vorzeichen nach Soll/Haben: debit auf expense = + (Kosten), credit = -
            // (Storno-Gegenbuchung). Nur so neutralisiert sich ein Storno-Paar.
            $sign = $line->type === 'debit' ? 1 : -1;
            $netto = $sign * (int) $line->amount;
            $ust = $sign * (int) ($line->tax_amount ?? 0);

            $totalNetto += $netto;
            $totalUst += $ust;
            $entry = $line->journalEntry;

            $reportLines[] = [
                'journal_entry_id' => $entry->id,
                'journal_number' => $entry->journal_number,
                'booking_date' => Carbon::parse($entry->booking_date)->toDateString(),
                'document_number' => $entry->beleg?->document_number,
                'description' => $entry->description,
                'account_code' => $line->account?->code,
                'account_name' => $line->account?->name,
                'status' => $entry->status,
                'netto' => $netto,
                'ust' => $ust,
                'brutto' => $netto + $ust,
            ];
        }

        return [
            'from' => $from,
            'to' => $to,
            'lines' => $reportLines,
            'totals' => [
                'netto' => $totalNetto,
                'ust' => $totalUst,
                'brutto' => $totalNetto + $totalUst,
            ],
        ];
    }
}
