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
            $invoice->load(['contact', 'lines']);

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
        return DB::transaction(function () use ($invoice, $paymentAccountId, $paymentDate) {
            $invoice->load('contact');

            if (! in_array($invoice->status, ['booked', 'sent'], true)) {
                throw new DomainException('Nur gebuchte/versendete Rechnungen können bezahlt werden.');
            }

            if (! $invoice->contact) {
                throw new DomainException('Kunde nicht gefunden.');
            }

            if (! $invoice->contact->customer_account_id) {
                throw new DomainException("Kunde '{$invoice->contact->name}' hat kein Debitorenkonto. Bitte Kunden neu anlegen.");
            }

            $entry = $this->bookingService->createBooking([
                'date' => $paymentDate,
                'description' => "Zahlung Rechnung {$invoice->invoice_number} - {$invoice->contact->name}",
                'contact_id' => $invoice->contact_id,
                'lines' => [
                    ['account_id' => $paymentAccountId, 'type' => 'debit', 'amount' => (int) $invoice->total],
                    ['account_id' => $invoice->contact->customer_account_id, 'type' => 'credit', 'amount' => (int) $invoice->total],
                ],
            ]);

            $this->bookingService->lockBooking($entry->id);

            $oldInvoiceStatus = $invoice->status;

            $invoice->update(['status' => 'paid']);

            // SPEC-06: fachlicher Event, explizit aus dem Service gefeuert
            // (siehe AuditObserver::isServiceManaged() - unterdrückt den
            // generischen 'updated'-Eintrag für genau diesen Übergang).
            AuditLog::record(
                $invoice,
                'payment_recorded',
                ['status' => $oldInvoiceStatus],
                [
                    'status' => $invoice->status,
                    'payment_account_id' => $paymentAccountId,
                    'payment_date' => $paymentDate,
                    'journal_entry_public_id' => $entry->public_id,
                ]
            );

            return $entry->fresh('lines');
        });
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

        // 1. Soll: Debitor (Kundenkonto) - Bruttobetrag
        $lines[] = [
            'account_id' => $invoice->contact->customer_account_id,
            'type' => 'debit',
            'amount' => (int) $invoice->total,
        ];

        // 2. Haben: Erlöse je (Konto, Steuersatz)
        $revenueGroups = [];
        foreach ($invoice->lines as $line) {
            $key = $line->account_id.'_'.$line->tax_rate;
            if (! isset($revenueGroups[$key])) {
                $revenueGroups[$key] = [
                    'account_id' => $line->account_id,
                    'tax_rate' => (float) $line->tax_rate,
                    'net_total' => 0,
                ];
            }
            $revenueGroups[$key]['net_total'] += (int) $line->line_total;
        }

        foreach ($revenueGroups as $group) {
            $lines[] = [
                'account_id' => $group['account_id'],
                'type' => 'credit',
                'amount' => $group['net_total'],
            ];
        }

        // 3. Haben: Umsatzsteuer je Steuersatz-Gruppe (nicht mehr pauschal tax_total auf
        // ein hartcodiertes Konto - siehe CLAUDE.md "Bekannte Fallen").
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
