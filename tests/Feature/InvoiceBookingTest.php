<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

/**
 * Kern-Feature-Test: POST /api/invoices/{id}/book (SPEC-02, Abschnitt 2.2;
 * gehärtet in SPEC-04, Abschnitt 4.1).
 *
 * Seit SPEC-04 läuft die Buchung transaktional über InvoiceBookingService
 * und wird sofort per BookingService::lockBooking() festgeschrieben (GoBD) -
 * die erzeugte JournalEntry ist danach unveränderlich (siehe GobdTest).
 */
class InvoiceBookingTest extends TestCase
{
    use RefreshDatabase;

    public function test_booking_invoice_creates_balanced_journal_entry_and_reduces_stock(): void
    {
        $data = TenantTestDataFactory::create('invbook');
        $invoice = $data->invoice; // draft, 1 Produktzeile (track_stock) + 1 Dienstleistungszeile

        $stockBefore = $data->productGoods->fresh()->stock_quantity;

        $token = auth('api')->login($data->user);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/invoices/{$invoice->id}/book");

        $response->assertOk();
        $response->assertJsonPath('status', 'booked');

        $invoice->refresh();
        $this->assertSame('booked', $invoice->status);
        $this->assertNotNull($invoice->journal_entry_id);

        $journalEntry = \App\Modules\Accounting\Models\JournalEntry::with('lines')->findOrFail($invoice->journal_entry_id);

        // GoBD: seit SPEC-04 wird die Rechnungsbuchung sofort festgeschrieben.
        $this->assertSame('posted', $journalEntry->status);
        $this->assertNotNull($journalEntry->locked_at);

        // Festgeschriebene Buchung ist unveränderlich (Enforcement siehe GobdTest,
        // ausführlich getestet - hier nur als zusätzlicher Beleg im Buchungs-Flow).
        try {
            $journalEntry->update(['description' => 'Sollte fehlschlagen']);
            $this->fail('Update einer festgeschriebenen Buchung hätte fehlschlagen müssen.');
        } catch (\DomainException $e) {
            $this->assertStringContainsString('kann nicht geändert werden', $e->getMessage());
        }

        $debitSum = $journalEntry->lines->where('type', 'debit')->sum('amount');
        $creditSum = $journalEntry->lines->where('type', 'credit')->sum('amount');

        // Soll = Haben = Brutto
        $this->assertSame($invoice->total, $debitSum);
        $this->assertSame($invoice->total, $creditSum);

        // Debitor-Sollzeile = total (Bruttobetrag)
        $debitorLine = $journalEntry->lines->where('type', 'debit')->first();
        $this->assertSame($data->accountDebitor->id, $debitorLine->account_id);
        $this->assertSame($invoice->total, $debitorLine->amount);

        // Erlös-Habenzeile(n) = subtotal (Nettobetrag), USt-Zeile = tax_total
        $revenueLine = $journalEntry->lines
            ->where('type', 'credit')
            ->where('account_id', $data->accountRevenue->id)
            ->first();
        $this->assertNotNull($revenueLine);
        $this->assertSame($invoice->subtotal, $revenueLine->amount);

        $taxLine = $journalEntry->lines
            ->where('type', 'credit')
            ->where('account_id', $data->accountTax->id)
            ->first();
        $this->assertNotNull($taxLine, 'USt-Zeile auf Konto 1776 muss vorhanden sein (Testdaten stellen das Konto bereit).');
        $this->assertSame($invoice->tax_total, $taxLine->amount);

        // Lagerabgang für die Produktzeile mit track_stock
        $productLine = $invoice->lines()->whereNotNull('product_id')->first();
        $stockAfter = $data->productGoods->fresh()->stock_quantity;
        $this->assertSame(
            (float) $stockBefore - (float) $productLine->quantity,
            (float) $stockAfter
        );
    }

    public function test_booking_already_booked_invoice_returns_400(): void
    {
        $data = TenantTestDataFactory::create('invbook2');
        $invoice = $data->invoice;

        $token = auth('api')->login($data->user);
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/invoices/{$invoice->id}/book")
            ->assertOk();

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/invoices/{$invoice->id}/book");

        $response->assertStatus(400);
    }
}
