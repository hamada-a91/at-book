<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Modules\Accounting\Models\JournalEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

class PaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_supports_partial_and_final_payment_then_reversal(): void
    {
        $data = TenantTestDataFactory::create('payments-invoice');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        $this->withHeaders($headers)->postJson("/api/invoices/{$data->invoice->id}/book")->assertOk();

        $first = $this->withHeaders($headers)->postJson("/api/invoices/{$data->invoice->id}/payments", [
            'amount' => 10000,
            'payment_date' => now()->toDateString(),
            'payment_account_id' => $data->accountBank->id,
        ]);

        $first->assertCreated()
            ->assertJsonPath('payable.amount_paid', 10000)
            ->assertJsonPath('payable.status', 'booked');

        $invoice = $data->invoice->fresh();
        $this->assertSame(10000, $invoice->amount_paid);
        $this->assertSame($invoice->total - 10000, $invoice->open_amount);

        $payment = Payment::firstOrFail();
        $entry = JournalEntry::with('lines')->findOrFail($payment->journal_entry_id);
        $this->assertSame('posted', $entry->status);
        $this->assertSame(10000, $entry->lines->where('type', 'debit')->sum('amount'));
        $this->assertSame(10000, $entry->lines->where('type', 'credit')->sum('amount'));
        $this->assertSame($data->accountBank->id, $entry->lines->where('type', 'debit')->first()->account_id);
        $this->assertSame($data->accountDebitor->id, $entry->lines->where('type', 'credit')->first()->account_id);

        $final = $this->withHeaders($headers)->postJson("/api/invoices/{$invoice->id}/payments", [
            'amount' => $invoice->open_amount,
            'payment_date' => now()->toDateString(),
            'payment_account_id' => $data->accountBank->id,
        ]);
        $final->assertCreated()->assertJsonPath('payable.status', 'paid');

        $invoice->refresh();
        $this->assertSame($invoice->total, $invoice->amount_paid);
        $this->assertSame(0, $invoice->open_amount);

        $lastPayment = Payment::latest('id')->firstOrFail();
        $this->withHeaders($headers)->deleteJson("/api/payments/{$lastPayment->id}")
            ->assertOk()
            ->assertJsonPath('payment.public_id', $lastPayment->public_id);

        $lastPayment->refresh();
        $invoice->refresh();
        $this->assertNotNull($lastPayment->reversed_at);
        $this->assertNotNull($lastPayment->reversal_journal_entry_id);
        $this->assertSame('booked', $invoice->status);
        $this->assertSame(10000, $invoice->amount_paid);
    }

    public function test_payment_in_locked_period_is_rejected(): void
    {
        $data = TenantTestDataFactory::create('payments-locked');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        $this->withHeaders($headers)->postJson("/api/invoices/{$data->invoice->id}/book")->assertOk();
        $data->companySetting->update(['books_locked_until' => now()->toDateString()]);

        $this->withHeaders($headers)->postJson("/api/invoices/{$data->invoice->id}/payments", [
            'amount' => 1000,
            'payment_date' => now()->toDateString(),
            'payment_account_id' => $data->accountBank->id,
        ])->assertUnprocessable();

        $this->assertDatabaseCount('payments', 0);
        $this->assertSame(0, $data->invoice->fresh()->amount_paid);
    }

    public function test_overpayment_is_rejected_without_side_effects(): void
    {
        $data = TenantTestDataFactory::create('payments-over');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        $this->withHeaders($headers)->postJson("/api/invoices/{$data->invoice->id}/book")->assertOk();
        $invoice = $data->invoice->fresh();

        $this->withHeaders($headers)->postJson("/api/invoices/{$invoice->id}/payments", [
            'amount' => $invoice->total + 1,
            'payment_date' => now()->toDateString(),
            'payment_account_id' => $data->accountBank->id,
        ])->assertUnprocessable();

        $this->assertDatabaseCount('payments', 0);
        $this->assertSame(0, $invoice->fresh()->amount_paid);
    }

    public function test_discount_and_creditor_payment_are_balanced(): void
    {
        $data = TenantTestDataFactory::create('payments-beleg');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        $this->withHeaders($headers)->postJson("/api/belege/{$data->beleg->id}/book")->assertOk();
        $beleg = $data->beleg->fresh();
        $discount = 100;

        $response = $this->withHeaders($headers)->postJson("/api/belege/{$beleg->id}/payments", [
            'amount' => $beleg->amount - $discount,
            'discount_amount' => $discount,
            'discount_account_id' => $data->accountRevenue->id,
            'payment_date' => now()->toDateString(),
            'payment_account_id' => $data->accountBank->id,
        ]);

        $response->assertCreated()->assertJsonPath('payable.status', 'paid');
        $payment = Payment::firstOrFail();
        $entry = JournalEntry::with('lines')->findOrFail($payment->journal_entry_id);
        $this->assertSame($beleg->amount, $entry->lines->where('type', 'debit')->sum('amount'));
        $this->assertSame($beleg->amount, $entry->lines->where('type', 'credit')->sum('amount'));
        $this->assertSame($data->accountKreditor->id, $entry->lines->where('type', 'debit')->first()->account_id);
    }

    public function test_open_items_report_uses_payments_at_the_requested_date(): void
    {
        $data = TenantTestDataFactory::create('payments-opos');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        $this->withHeaders($headers)->postJson("/api/invoices/{$data->invoice->id}/book")->assertOk();
        $invoice = $data->invoice->fresh();
        $paymentDate = now()->addDay()->toDateString();

        $this->withHeaders($headers)->postJson("/api/invoices/{$invoice->id}/payments", [
            'amount' => 5000,
            'payment_date' => $paymentDate,
            'payment_account_id' => $data->accountBank->id,
        ])->assertCreated();

        $before = $this->withHeaders($headers)->getJson('/api/reports/open-items?type=debitor&as_of='.now()->toDateString());
        $before->assertOk()->assertJsonPath('items.0.open_amount', $invoice->total);

        $after = $this->withHeaders($headers)->getJson('/api/reports/open-items?type=debitor&as_of='.$paymentDate);
        $after->assertOk()->assertJsonPath('items.0.open_amount', $invoice->total - 5000);
    }
    public function test_paid_beleg_requires_a_payment_account_when_created(): void
    {
        $data = TenantTestDataFactory::create('payments-beleg-required-account');
        $token = auth('api')->login($data->user);

        $response = $this->withHeaders(['Authorization' => "Bearer {$token}"])->postJson('/api/belege', [
            'document_type' => 'eingang',
            'title' => 'Direkt bezahlter Testbeleg',
            'document_date' => now()->toDateString(),
            'amount' => 4300,
            'tax_amount' => 0,
            'contact_id' => $data->vendor->id,
            'category_account_id' => $data->accountExpense->id,
            'is_paid' => true,
        ]);

        $response->assertUnprocessable()->assertJsonValidationErrors('payment_account_id');
    }

    public function test_legacy_paid_beleg_without_payment_account_cannot_be_booked(): void
    {
        $data = TenantTestDataFactory::create('payments-beleg-book-guard');
        $token = auth('api')->login($data->user);
        $data->beleg->update(['is_paid' => true, 'payment_account_id' => null]);

        $this->withHeaders(['Authorization' => "Bearer {$token}"])
            ->postJson("/api/belege/{$data->beleg->id}/book")
            ->assertUnprocessable()
            ->assertJsonPath('error', 'Für einen als bezahlt markierten Beleg ist ein Zahlungskonto erforderlich.');

        $this->assertSame('draft', $data->beleg->fresh()->status);
    }

    public function test_bank_account_cannot_be_used_as_discount_account(): void
    {
        $data = TenantTestDataFactory::create('payments-discount-account');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        $this->withHeaders($headers)->postJson("/api/belege/{$data->beleg->id}/book")->assertOk();
        $beleg = $data->beleg->fresh();

        $this->withHeaders($headers)->postJson("/api/belege/{$beleg->id}/payments", [
            'amount' => $beleg->amount - 100,
            'discount_amount' => 100,
            'discount_account_id' => $data->accountBank->id,
            'payment_date' => now()->toDateString(),
            'payment_account_id' => $data->accountBank->id,
        ])->assertUnprocessable()
            ->assertJsonPath('error', 'Als Skontokonto ist nur ein Aufwands- oder Erlöskonto erlaubt.');

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_open_items_report_supports_month_and_year_views(): void
    {
        $data = TenantTestDataFactory::create('payments-opos-periods');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        $this->withHeaders($headers)->postJson("/api/invoices/{$data->invoice->id}/book")->assertOk();

        $this->withHeaders($headers)->getJson(
            '/api/reports/open-items?view=month&year='.now()->year.'&month='.now()->month
        )->assertOk()
            ->assertJsonPath('view', 'month')
            ->assertJsonPath('year', now()->year)
            ->assertJsonPath('month', now()->month)
            ->assertJsonPath('as_of', now()->endOfMonth()->toDateString());

        $this->withHeaders($headers)->getJson(
            '/api/reports/open-items?view=year&year='.now()->year
        )->assertOk()
            ->assertJsonPath('view', 'year')
            ->assertJsonPath('year', now()->year)
            ->assertJsonPath('month', null)
            ->assertJsonPath('as_of', now()->endOfYear()->toDateString());
    }

}
