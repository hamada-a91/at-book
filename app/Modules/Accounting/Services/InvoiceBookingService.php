<?php

namespace App\Modules\Accounting\Services;

use App\Models\Invoice;
use App\Models\Product;
use App\Models\TaxCode;
use App\Modules\Accounting\Models\AuditLog;
use App\Modules\Accounting\Models\JournalEntry;
use App\Services\InventoryService;
use DomainException;
use Illuminate\Support\Facades\DB;

/**
 * SPEC-04 (4.1): löst die bisherige, ungehärtete Buchungslogik aus
 * InvoiceController::book()/recordPayment() ab.
 *
 * Alles läuft in EINER DB::transaction() über den BookingService (Soll=Haben-
 * Check inklusive), wird sofort per lockBooking() festgeschrieben (GoBD) und
 * nutzt die tenant-scoped USt-Konto-Auflösung aus TaxCode::resolveOutputTaxAccount()
 * statt hartcodierter Kontocodes ('1776'/'1771' nur noch als allerletzte
 * Fallback-Stufe im Resolver selbst, siehe App\Models\TaxCode).
 */
class InvoiceBookingService
{
    public function __construct(
        private BookingService $bookingService,
        private InventoryService $inventoryService,
    ) {}

    /**
     * Bucht eine Rechnung (Forderung):
     * Soll: Debitor (Kundenkonto) - Bruttobetrag
     * Haben: Erlöskonten - Nettobetrag (je Konto+Steuersatz gruppiert)
     * Haben: Umsatzsteuer - je Steuersatz-Gruppe auf dem zugeordneten Konto
     *
     * @throws DomainException bei fachlichen Fehlern (Status, fehlendes Konto,
     *                         nicht auflösbares USt-Konto, Rundungsdifferenz)
     */
    public function bookInvoice(Invoice $invoice): JournalEntry
    {
        return DB::transaction(function () use ($invoice) {
            // SPEC-08 (Teil A): 'project' geladen für die Durchreich-Logik in
            // buildLines() (project_id -> dessen cost_object_id als Default für
            // alle erzeugten Zeilen).
            $invoice->load(['contact', 'lines', 'project']);

            $this->assertBookable($invoice);

            $lines = $this->buildLines($invoice);

            $entry = $this->bookingService->createBooking([
                'date' => $invoice->invoice_date,
                'description' => "Rechnung {$invoice->invoice_number} - {$invoice->contact->name}",
                'contact_id' => $invoice->contact_id,
                'lines' => $lines,
            ]);

            // GoBD: sofort festschreiben - eine über die Rechnung gebuchte Journalbuchung
            // darf nie als 'posted' erscheinen, ohne tatsächlich gesperrt zu sein (siehe
            // CLAUDE.md "Bekannte Fallen").
            $this->bookingService->lockBooking($entry->id);

            $oldInvoiceStatus = $invoice->status;

            $invoice->update([
                'status' => 'booked',
                'journal_entry_id' => $entry->id,
            ]);

            // SPEC-06: fachlicher Event, explizit aus dem Service gefeuert
            // (siehe AuditObserver::isServiceManaged() - unterdrückt den
            // generischen 'updated'-Eintrag für genau diesen Übergang).
            AuditLog::record(
                $invoice,
                'booked',
                ['status' => $oldInvoiceStatus, 'journal_entry_id' => null],
                ['status' => $invoice->status, 'journal_entry_id' => $invoice->journal_entry_id]
            );

            $this->reduceInventory($invoice);

            return $entry->fresh('lines');
        });
    }

    /**
     * Erfasst eine Zahlung zu einer gebuchten Rechnung:
     * Soll: Kasse/Bank - Bruttobetrag
     * Haben: Debitor - Bruttobetrag
     *
     * @throws DomainException bei fachlichen Fehlern (Status, fehlendes Debitorenkonto)
     */
    public function recordPayment(Invoice $invoice, int $paymentAccountId, string $paymentDate): JournalEntry
    {
        $invoice->refresh();
        $payment = app(PaymentService::class)->recordPayment(
            $invoice,
            $invoice->open_amount,
            $paymentDate,
            $paymentAccountId
        );

        return $payment->journalEntry->fresh('lines');
    }

    /**
     * Status, Kontakt und Debitorenkonto prüfen, bevor irgendetwas gebucht wird.
     *
     * @throws DomainException
     */
    private function assertBookable(Invoice $invoice): void
    {
        if ($invoice->status !== 'draft') {
            throw new DomainException('Rechnung ist bereits gebucht.');
        }

        // SPEC-05 (Teil B): Erfassungssperre gilt auch für die automatische
        // Rechnungsbuchung - Rechnungsdatum in einer festgeschriebenen Periode ->
        // DomainException (Controller macht daraus 422), bevor Zeilen aufgebaut
        // werden. createBooking() prüft das ohnehin nochmal (doppelte Absicherung).
        $this->bookingService->assertPeriodOpen($invoice->invoice_date->format('Y-m-d'));

        if (! $invoice->contact) {
            throw new DomainException('Kunde nicht gefunden.');
        }

        if (! $invoice->contact->customer_account_id) {
            throw new DomainException("Kunde '{$invoice->contact->name}' hat kein Debitorenkonto. Bitte Kunden neu anlegen.");
        }

        if ($invoice->lines->isEmpty()) {
            throw new DomainException('Rechnung hat keine Positionen.');
        }
    }

    /**
     * Baut die Buchungszeilen: Soll Debitor brutto / Haben Erlöskonten netto (je
     * Konto+Steuersatz) / Haben USt je Steuersatz-Gruppe.
     *
     * @return array<int, array{account_id:int,type:string,amount:int}>
     *
     * @throws DomainException wenn kein USt-Konto auflösbar ist oder die berechnete
     *                         USt zu stark von Invoice::tax_total abweicht.
     */
    private function buildLines(Invoice $invoice): array
    {
        $lines = [];

        // SPEC-08 (Teil A, Durchreich-Logik): Dokument.project_id -> dessen
        // cost_object_id ist der Default für ALLE erzeugten Zeilen dieser
        // Rechnung (auch Debitor-/USt-Sammelzeile, die keinen eigenen
        // invoice_line-Ursprung haben und daher kein Line-Override kennen
        // können). Ein cost_center_id-Default auf Dokumentebene gibt es
        // bewusst NICHT (siehe SPEC-08, "UI-Leitprinzip: Projekt-zentriert" -
        // Kostenstellen sitzen ausschließlich an der Zeile).
        $projectCostObjectId = $invoice->project?->cost_object_id;

        // 1. Soll: Debitor (Kundenkonto) - Bruttobetrag
        $lines[] = [
            'account_id' => $invoice->contact->customer_account_id,
            'type' => 'debit',
            'amount' => (int) $invoice->total,
            'cost_object_id' => $projectCostObjectId,
        ];

        // 2. Haben: Erlöse je (Konto, Steuersatz, Kostenstelle, Kostenträger) - die
        // Gruppierung berücksichtigt SPEC-08 die aufgelösten Dimensionen mit, damit
        // zwei invoice_lines mit gleichem Konto/Steuersatz, aber UNTERSCHIEDLICHER
        // Zeilen-Dimension, nicht fälschlich in eine Buchungszeile zusammengefasst
        // werden (eine Buchungszeile hat genau EINE Dimension).
        $revenueGroups = [];
        foreach ($invoice->lines as $line) {
            $lineCostCenterId = $line->cost_center_id;
            // Zeilen-eigene cost_object_id überschreibt den Dokument-Default (Regel
            // aus SPEC-08, "Durchreich-Logik").
            $lineCostObjectId = $line->cost_object_id ?? $projectCostObjectId;

            $key = implode('_', [$line->account_id, $line->tax_rate, $lineCostCenterId, $lineCostObjectId]);
            if (! isset($revenueGroups[$key])) {
                $revenueGroups[$key] = [
                    'account_id' => $line->account_id,
                    'tax_rate' => (float) $line->tax_rate,
                    'net_total' => 0,
                    'cost_center_id' => $lineCostCenterId,
                    'cost_object_id' => $lineCostObjectId,
                ];
            }
            $revenueGroups[$key]['net_total'] += (int) $line->line_total;
        }

        foreach ($revenueGroups as $group) {
            // SPEC-08 (Teil A, Kosten-Nachweis-Ableitung): tax_amount wird HIER,
            // zusätzlich zur separaten USt-Sammelzeile unten (SPEC-04, 4.2 -
            // Trial-Balance-Korrektheit je Steuersatz), informativ auf der
            // Erlöszeile selbst annotiert (amount bleibt netto, tax_amount ist
            // eine reine Zusatzangabe, beeinflusst NICHT die Soll=Haben-Prüfung).
            // Grund: ProjectReportService::costReport()/ein künftiges Pendant für
            // Erlöse liest Netto/USt/Brutto direkt von der (dimensionierten)
            // Erlös-/Aufwandszeile selbst, statt USt-Konto-Zeilen über den
            // gesamten Beleg hinweg fachlich eindeutig zurückzuordnen - siehe
            // Docblock von App\Modules\Projects\Services\ProjectReportService.
            $lines[] = [
                'account_id' => $group['account_id'],
                'type' => 'credit',
                'amount' => $group['net_total'],
                'tax_amount' => (int) round($group['net_total'] * $group['tax_rate'] / 100),
                'cost_center_id' => $group['cost_center_id'],
                'cost_object_id' => $group['cost_object_id'],
            ];
        }

        // 3. Haben: Umsatzsteuer je Steuersatz-Gruppe (nicht mehr pauschal tax_total auf
        // ein hartcodiertes Konto - siehe CLAUDE.md "Bekannte Fallen"). Bewusst NICHT
        // weiter nach Dimension aufgesplittet (USt-Konten sind KOST-neutral) - bekommt
        // trotzdem den Dokument-Default, damit "für alle Zeilen" (SPEC-08) konsistent
        // eingehalten wird.
        $taxByRate = [];
        foreach ($revenueGroups as $group) {
            if ($group['tax_rate'] <= 0) {
                continue;
            }
            $rateKey = (string) $group['tax_rate'];
            $taxByRate[$rateKey]['rate'] ??= $group['tax_rate'];
            $taxByRate[$rateKey]['net_total'] = ($taxByRate[$rateKey]['net_total'] ?? 0) + $group['net_total'];
        }

        $computedTaxTotal = 0;
        foreach ($taxByRate as $group) {
            $taxAccount = TaxCode::resolveOutputTaxAccount($group['rate']);
            $taxAmount = (int) round($group['net_total'] * $group['rate'] / 100);
            $computedTaxTotal += $taxAmount;

            if ($taxAmount > 0) {
                $lines[] = [
                    'account_id' => $taxAccount->id,
                    'type' => 'credit',
                    'amount' => $taxAmount,
                    'cost_object_id' => $projectCostObjectId,
                ];
            }
        }

        // Rundungstoleranz: bis zu 1 Cent Abweichung PRO Steuersatz-Gruppe zulässig
        // (SPEC-04, 4.2), summiert über alle Gruppen dieser Rechnung.
        $tolerance = max(count($taxByRate), 1);
        $diff = abs($computedTaxTotal - (int) $invoice->tax_total);
        if ($diff > $tolerance) {
            throw new DomainException(sprintf(
                'Berechnete Umsatzsteuer (%d Cent) weicht von der Rechnung (%d Cent) um mehr als die zulässige Rundungstoleranz ab.',
                $computedTaxTotal,
                (int) $invoice->tax_total
            ));
        }

        return $lines;
    }

    /**
     * Lagerabgang für Positionen mit Produktbezug (innerhalb derselben Transaktion).
     */
    private function reduceInventory(Invoice $invoice): void
    {
        foreach ($invoice->lines as $line) {
            if (empty($line->product_id)) {
                continue;
            }

            $product = Product::find($line->product_id);
            if (! $product) {
                continue;
            }

            $this->inventoryService->removeStock(
                $product,
                $line->quantity,
                'sale',
                "Verkauf via Rechnung {$invoice->invoice_number}",
                $invoice
            );
        }
    }
}
