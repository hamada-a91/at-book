<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\TaxCode;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Services\BookingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

/**
 * SPEC-04 (4.1/4.2): Buchung mit gemischten Steuersätzen und
 * Transaktions-Atomarität bei fehlendem USt-Konto.
 */
class InvoiceBookingTaxTest extends TestCase
{
    use RefreshDatabase;

    public function test_booking_invoice_with_mixed_tax_rates_creates_two_correctly_mapped_tax_lines(): void
    {
        $data = TenantTestDataFactory::create('mixedtax');

        // Zweiten Steuersatz (7%) für den Tenant einrichten - die Test-Factory
        // legt standardmäßig nur UST19 an.
        $accountTax7 = Account::where('code', '1771')->firstOrFail();
        TaxCode::create([
            'code' => 'UST7',
            'name' => 'Umsatzsteuer 7%',
            'type' => 'output_tax',
            'rate' => 7,
            'account_id' => $accountTax7->id,
        ]);

        // Eigene Rechnung mit einer 19%- und einer 7%-Position (statt der
        // Factory-Standardrechnung, die nur 19% enthält).
        $netA = 10000; // 19%
        $netB = 5000;  // 7%
        $taxA = (int) round($netA * 0.19);
        $taxB = (int) round($netB * 0.07);
        $subtotal = $netA + $netB;
        $taxTotal = $taxA + $taxB;
        $total = $subtotal + $taxTotal;

        $invoice = Invoice::create([
            'invoice_number' => 'RE-mixedtax-0002',
            'contact_id' => $data->customer->id,
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(14)->toDateString(),
            'status' => 'draft',
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'total' => $total,
        ]);
        $invoice->lines()->create([
            'description' => 'Position 19%',
            'quantity' => 1,
            'unit' => 'Stück',
            'unit_price' => $netA,
            'tax_rate' => 19,
            'line_total' => $netA,
            'account_id' => $data->accountRevenue->id,
        ]);
        $invoice->lines()->create([
            'description' => 'Position 7%',
            'quantity' => 1,
            'unit' => 'Stück',
            'unit_price' => $netB,
            'tax_rate' => 7,
            'line_total' => $netB,
            'account_id' => $data->accountRevenue->id,
        ]);

        $token = auth('api')->login($data->user);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/invoices/{$invoice->id}/book");

        $response->assertOk();
        $response->assertJsonPath('status', 'booked');

        $invoice->refresh();
        $journalEntry = JournalEntry::with('lines')->findOrFail($invoice->journal_entry_id);

        $this->assertNotNull($journalEntry->locked_at);

        $debitSum = (int) $journalEntry->lines->where('type', 'debit')->sum('amount');
        $creditSum = (int) $journalEntry->lines->where('type', 'credit')->sum('amount');
        $this->assertSame($total, $debitSum);
        $this->assertSame($total, $creditSum);

        // Zwei USt-Zeilen auf den jeweils richtigen Konten (1776 für 19%, 1771 für 7%).
        $taxLine19 = $journalEntry->lines
            ->where('type', 'credit')
            ->where('account_id', $data->accountTax->id)
            ->first();
        $this->assertNotNull($taxLine19, 'USt-Zeile für 19% auf Konto 1776 fehlt.');
        $this->assertSame($taxA, $taxLine19->amount);

        $taxLine7 = $journalEntry->lines
            ->where('type', 'credit')
            ->where('account_id', $accountTax7->id)
            ->first();
        $this->assertNotNull($taxLine7, 'USt-Zeile für 7% auf Konto 1771 fehlt.');
        $this->assertSame($taxB, $taxLine7->amount);

        $this->assertNotSame($taxLine19->account_id, $taxLine7->account_id);
    }

    /**
     * Transaktions-Atomarität: Wenn für einen der Steuersätze kein USt-Konto
     * auflösbar ist (weder Steuerschlüssel-Konfiguration noch Fallback-Konto),
     * darf NICHTS aus dem Buchungsversuch übrig bleiben - keine JournalEntry,
     * kein Statuswechsel der Rechnung, kein Lagerabgang.
     */
    public function test_booking_invoice_with_unresolvable_tax_account_rolls_back_completely(): void
    {
        $data = TenantTestDataFactory::create('notax');

        // Fallback-Konto für 7% entfernen UND keinen Steuerschlüssel für 7% anlegen,
        // damit TaxCode::resolveOutputTaxAccount(7) garantiert eine DomainException wirft.
        app()->instance('currentTenant', $data->tenant);
        Auth::setUser($data->user);
        Account::where('code', '1771')->delete();

        $netA = 10000; // 19% - hat ein gültiges Konto
        $netB = 5000;  // 7% - kein Konto mehr auflösbar
        $taxA = (int) round($netA * 0.19);
        $taxB = (int) round($netB * 0.07);
        $subtotal = $netA + $netB;
        $taxTotal = $taxA + $taxB;
        $total = $subtotal + $taxTotal;

        $invoice = Invoice::create([
            'invoice_number' => 'RE-notax-0002',
            'contact_id' => $data->customer->id,
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(14)->toDateString(),
            'status' => 'draft',
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'total' => $total,
        ]);
        $invoice->lines()->create([
            'product_id' => $data->productGoods->id,
            'description' => 'Position 19%',
            'quantity' => 1,
            'unit' => 'Stück',
            'unit_price' => $netA,
            'tax_rate' => 19,
            'line_total' => $netA,
            'account_id' => $data->accountRevenue->id,
        ]);
        $invoice->lines()->create([
            'description' => 'Position 7% (nicht auflösbar)',
            'quantity' => 1,
            'unit' => 'Stück',
            'unit_price' => $netB,
            'tax_rate' => 7,
            'line_total' => $netB,
            'account_id' => $data->accountRevenue->id,
        ]);

        $stockBefore = $data->productGoods->fresh()->stock_quantity;
        $journalEntryCountBefore = JournalEntry::count();

        $token = auth('api')->login($data->user);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/invoices/{$invoice->id}/book");

        $response->assertStatus(422);
        $response->assertJsonStructure(['error']);
        $this->assertStringContainsString('Umsatzsteuerkonto', $response->json('error'));

        // Kein Stacktrace/SQL im Fehlertext.
        $this->assertStringNotContainsString('Exception', $response->json('error'));
        $this->assertStringNotContainsString('SQLSTATE', $response->json('error'));

        // Nichts wurde persistiert: kein neuer JournalEntry, Invoice bleibt draft,
        // kein journal_entry_id, kein Lagerabgang.
        $this->assertSame($journalEntryCountBefore, JournalEntry::count());

        $invoice->refresh();
        $this->assertSame('draft', $invoice->status);
        $this->assertNull($invoice->journal_entry_id);

        $stockAfter = $data->productGoods->fresh()->stock_quantity;
        $this->assertSame((float) $stockBefore, (float) $stockAfter);
    }

    /**
     * Storno (Generalumkehr) einer Rechnungsbuchung funktioniert weiterhin, obwohl
     * die JournalEntry seit SPEC-04 sofort gelockt wird - reverseBooking() ist die
     * einzige erlaubte Ausnahme vom GoBD-Update-Verbot (siehe JournalEntry::booted()).
     */
    public function test_reversing_a_locked_invoice_booking_still_works(): void
    {
        $data = TenantTestDataFactory::create('invstorno');
        $invoice = $data->invoice;

        $token = auth('api')->login($data->user);
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/invoices/{$invoice->id}/book")
            ->assertOk();

        $invoice->refresh();
        $journalEntryId = $invoice->journal_entry_id;

        app()->instance('currentTenant', $data->tenant);
        Auth::setUser($data->user);
        $reversal = app(BookingService::class)->reverseBooking($journalEntryId);

        $original = JournalEntry::findOrFail($journalEntryId);
        $this->assertSame('cancelled', $original->status);
        $this->assertNotNull($original->locked_at, 'locked_at bleibt auch nach dem Storno erhalten (GoBD-Historie).');

        $this->assertSame('posted', $reversal->status);
        $this->assertNotNull($reversal->locked_at);

        $debitSum = (int) $reversal->lines()->where('type', 'debit')->sum('amount');
        $creditSum = (int) $reversal->lines()->where('type', 'credit')->sum('amount');
        $this->assertSame($invoice->total, $debitSum);
        $this->assertSame($invoice->total, $creditSum);
    }

    /**
     * recordPayment() läuft jetzt ebenfalls über InvoiceBookingService (SPEC-04, 4.1/4.4):
     * Soll Kasse/Bank, Haben Debitor, transaktional und sofort festgeschrieben.
     */
    public function test_recording_payment_for_booked_invoice_creates_locked_journal_entry(): void
    {
        $data = TenantTestDataFactory::create('invpay');
        $invoice = $data->invoice;

        $token = auth('api')->login($data->user);
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/invoices/{$invoice->id}/book")
            ->assertOk();

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/invoices/{$invoice->id}/payment", [
                'payment_account_id' => $data->accountBank->id,
                'payment_date' => now()->toDateString(),
            ]);

        $response->assertOk();
        $response->assertJsonPath('status', 'paid');

        $invoice->refresh();
        $this->assertSame('paid', $invoice->status);

        $paymentEntry = JournalEntry::where('description', 'like', 'Zahlung%')->latest('id')->firstOrFail();
        $this->assertSame('posted', $paymentEntry->status);
        $this->assertNotNull($paymentEntry->locked_at);

        $debitLine = $paymentEntry->lines()->where('type', 'debit')->first();
        $creditLine = $paymentEntry->lines()->where('type', 'credit')->first();
        $this->assertSame($data->accountBank->id, $debitLine->account_id);
        $this->assertSame($data->accountDebitor->id, $creditLine->account_id);
        $this->assertSame($invoice->total, $debitLine->amount);
        $this->assertSame($invoice->total, $creditLine->amount);
    }

    /**
     * Fehlerpfad von recordPayment(): fremdes/nicht existentes Konto -> 422 mit
     * Validierungsfehler (TenantExists über BookInvoiceRequest), keine Buchung.
     */
    public function test_recording_payment_with_invalid_account_returns_422(): void
    {
        $data = TenantTestDataFactory::create('invpayfail');
        $invoice = $data->invoice;

        $token = auth('api')->login($data->user);
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/invoices/{$invoice->id}/book")
            ->assertOk();

        $journalEntryCountBefore = JournalEntry::count();

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/invoices/{$invoice->id}/payment", [
                'payment_account_id' => 999999999,
                'payment_date' => now()->toDateString(),
            ]);

        $response->assertStatus(422);
        $this->assertSame($journalEntryCountBefore, JournalEntry::count());

        $invoice->refresh();
        $this->assertSame('booked', $invoice->status);
    }
}
