<?php

namespace App\Modules\Projects\Services;

use App\Models\Beleg;
use App\Modules\Accounting\Models\JournalEntryLine;
use App\Modules\Projects\Models\Project;
use Carbon\Carbon;

/**
 * SPEC-08 (Teil A): Auswertungen für ein einzelnes Projekt - liefert reine
 * PHP-Arrays (Teil B rendert daraus JSON-Responses/PDF).
 *
 * WICHTIG (Reports-Prinzip, siehe CLAUDE.md/ReportsController-Docblock):
 * Auswertungen werden NIE mit `status != cancelled` gefiltert - `posted` UND
 * `cancelled` fließen beide ein, Storno-Paare (Original + Generalumkehr)
 * neutralisieren sich zu 0 in der Summe. `draft`-Buchungen sind noch nicht
 * festgeschrieben und fließen NICHT ein (nur "posted"/"cancelled" gelten als
 * "festgeschrieben" im Sinne dieser Auswertung).
 *
 * Netto/USt/Brutto-Ableitung pro Kostenbuchung (kritisch für Teil B/PDF!):
 * journal_entry_lines.amount ist bereits NETTO (die USt wird beim Buchen -
 * siehe InvoiceBookingService::buildLines()/BelegController::book() - als
 * EIGENE Buchungszeile auf ein separates USt-/Vorsteuerkonto gebucht, nicht
 * anteilig auf der Aufwands-/Erlöszeile). Damit costReport() trotzdem
 * Netto/USt/Brutto PRO Kostenbuchung ausweisen kann, ohne die separate
 * USt-Zeile fachlich eindeutig zurückzuordnen (mehrere dimensionierte
 * Aufwandszeilen könnten sich in derselben Buchung eine gemeinsame
 * USt-Sammelzeile teilen), wird seit SPEC-08 (Teil A) das ohnehin
 * vorhandene, bis dahin für automatisch gebuchte Belege/Rechnungen ungenutzte
 * Feld journal_entry_lines.tax_amount zusätzlich AUF DER
 * Aufwands-/Erlöszeile SELBST informativ mitgeschrieben (amount bleibt
 * netto, tax_amount beeinflusst die Soll=Haben-Prüfung nicht). Daraus (mit
 * Vorzeichen nach Soll/Haben-Richtung, siehe costReport() - eine
 * 'debit'-Zeile auf dem expense-Konto ist +, eine 'credit'-Zeile (z.B. die
 * Gegenbuchung eines Storno) ist -, damit sich Storno-Paare zu 0 summieren):
 *   netto  = ± zeile.amount
 *   ust    = ± zeile.tax_amount (0, falls nicht gesetzt - z.B. bei älteren,
 *            vor SPEC-08 gebuchten Zeilen oder manuellen Buchungen ohne
 *            tax_amount-Angabe)
 *   brutto = netto + ust
 * Diese Annahme ist eine bewusste, dokumentierte Vereinfachung (siehe
 * Abschlussbericht SPEC-08 Teil A) - sie setzt voraus, dass die Zeile, auf
 * der die Dimension sitzt, auch die für sie relevante USt in tax_amount
 * trägt. Das ist für InvoiceBookingService/BelegController-Buchungen ab
 * SPEC-08 (Teil A) der Fall; für Alt-Buchungen (vor diesem Release) und für
 * manuelle Buchungen ohne tax_amount-Angabe ist ust=0 (die Buchung bleibt
 * trotzdem korrekt in der Trial Balance, nur der PDF-Kosten-Nachweis zeigt
 * für diese Zeile 0 USt an).
 */
class ProjectReportService
{
    /**
     * Buchungsstatus, die als "festgeschrieben" gelten (siehe Klassen-Docblock).
     */
    private const POSTED_STATUSES = ['posted', 'cancelled'];

    /**
     * Budget vs. Ist: Umsatz, Kosten, Gewinn, Budgetauslastung, offene Belege.
     *
     * @return array{
     *     project_id:int, project_number:string, project_name:string,
     *     revenue:int, cost:int, profit:int, budget_amount:?int,
     *     budget_used_pct:?float, open_belege_count:int
     * }
     */
    public function summary(Project $project): array
    {
        $costObjectId = $project->cost_object_id;

        $lines = JournalEntryLine::with('account')
            ->where('cost_object_id', $costObjectId)
            ->whereHas('journalEntry', fn ($q) => $q->whereIn('status', self::POSTED_STATUSES))
            ->get();

        $revenue = 0;
        $cost = 0;

        foreach ($lines as $line) {
            $accountType = $line->account?->type;

            if ($accountType === 'revenue') {
                $revenue += ($line->type === 'credit' ? $line->amount : -$line->amount);
            } elseif ($accountType === 'expense') {
                $cost += ($line->type === 'debit' ? $line->amount : -$line->amount);
            }
        }

        $profit = $revenue - $cost;

        $budgetAmount = $project->budget_amount;
        $budgetUsedPct = ($budgetAmount !== null && $budgetAmount > 0)
            ? round(($cost / $budgetAmount) * 100, 1)
            : null;

        // "Offene Belege": dem Projekt zugeordnete Belege, die noch nicht
        // verbucht/abgeschlossen sind (Status 'draft') - Annahme, siehe
        // Abschlussbericht SPEC-08 Teil A.
        $openBelegeCount = Beleg::where('project_id', $project->id)
            ->where('status', 'draft')
            ->count();

        return [
            'project_id' => $project->id,
            'project_number' => $project->number,
            'project_name' => $project->name,
            'revenue' => $revenue,
            'cost' => $cost,
            'profit' => $profit,
            'budget_amount' => $budgetAmount,
            'budget_used_pct' => $budgetUsedPct,
            'open_belege_count' => $openBelegeCount,
        ];
    }

    /**
     * Kosten-Nachweis: Liste der Kostenbuchungen (Zeilen auf expense-Konten,
     * dimensioniert auf den Kostenträger des Projekts) im Zeitraum, je mit
     * Netto/USt/Brutto (siehe Klassen-Docblock für die Ableitung), plus
     * Summenzeile.
     *
     * @return array{
     *     project_id:int, from:?string, to:?string,
     *     lines: list<array{
     *         journal_entry_id:int, journal_number:?string, booking_date:string,
     *         document_number:?string, description:string, account_code:?string,
     *         account_name:?string, status:string, netto:int, ust:int, brutto:int
     *     }>,
     *     totals: array{netto:int, ust:int, brutto:int}
     * }
     */
    public function costReport(Project $project, ?string $from = null, ?string $to = null): array
    {
        $costObjectId = $project->cost_object_id;

        $query = JournalEntryLine::with(['account', 'journalEntry.beleg'])
            ->where('cost_object_id', $costObjectId)
            ->whereHas('account', fn ($q) => $q->where('type', 'expense'))
            ->whereHas('journalEntry', function ($q) use ($from, $to) {
                $q->whereIn('status', self::POSTED_STATUSES);
                if ($from) {
                    $q->whereDate('booking_date', '>=', $from);
                }
                if ($to) {
                    $q->whereDate('booking_date', '<=', $to);
                }
            });

        $lines = $query->get()->sortBy(fn (JournalEntryLine $line) => $line->journalEntry->booking_date.'-'.$line->journalEntry->id)
            ->values();

        $reportLines = [];
        $totalNetto = 0;
        $totalUst = 0;

        foreach ($lines as $line) {
            // Vorzeichen nach Soll/Haben-Richtung des expense-Kontos (debit-normal):
            // eine 'debit'-Zeile ERHÖHT die Kosten (+), eine 'credit'-Zeile (z.B. die
            // Gegenbuchung einer Generalumkehr/Storno, siehe
            // BookingService::reverseBooking() - vertauscht debit/credit, übernimmt
            // amount/tax_amount aber unverändert) REDUZIERT sie (-). Nur so
            // neutralisiert sich ein Storno-Paar in der Summenzeile zu 0 (Reports-
            // Prinzip) - ohne Vorzeichen würden Original- und Storno-Zeile sich
            // addieren statt aufheben.
            $sign = $line->type === 'debit' ? 1 : -1;
            $netto = $sign * (int) $line->amount;
            $ust = $sign * (int) ($line->tax_amount ?? 0);
            $brutto = $netto + $ust;

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
                'brutto' => $brutto,
            ];
        }

        return [
            'project_id' => $project->id,
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
