<?php

namespace Tests\Feature;

use App\Models\BankTransaction;
use App\Models\Beleg;
use App\Models\Payment;
use App\Models\User;
use App\Modules\Accounting\Models\JournalEntry;
use App\Services\Banking\BankCsvImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

class BankReconciliationTest extends TestCase
{
    use RefreshDatabase;

    public function test_csv_import_preview_deduplicates_and_exposes_skipped_rows(): void
    {
        $data = TenantTestDataFactory::create('bank-import');
        $headers = $this->headersFor($data->user);
        $csv = "Buchungsdatum;Auftraggeber;Verwendungszweck;Betrag;Waehrung\n"
            ."31.03.2026 03:00:24;Muster GmbH;RE-bank-import-0001;1.234,56;EUR\n"
            ."31.12.2013;Alt GmbH;zu alt;10,00;EUR\n";
        $file = UploadedFile::fake()->createWithContent('konto.csv', $csv);

        $preview = $this->withHeaders($headers)->post('/api/bank-imports/preview', [
            'bank_account_id' => $data->bankAccount->id,
            'file' => $file,
        ]);

        $preview->assertOk()
            ->assertJsonPath('delimiter', ';')
            ->assertJsonPath('mapping_suggestion.booking_date', 'Buchungsdatum')
            ->assertJsonPath('mapping_suggestion.amount', 'Betrag')
            ->assertJsonPath('total_rows', 2);

        $settings = [
            'delimiter' => ';',
            'encoding' => 'UTF-8',
            'mapping' => [
                'booking_date' => 'Buchungsdatum',
                'counterparty' => 'Auftraggeber',
                'purpose' => 'Verwendungszweck',
                'amount' => 'Betrag',
                'currency' => 'Waehrung',
            ],
        ];

        $firstImport = $this->withHeaders($headers)->post('/api/bank-imports', [
            'bank_account_id' => $data->bankAccount->id,
            'settings' => json_encode($settings),
            'file' => UploadedFile::fake()->createWithContent('konto.csv', $csv),
        ]);

        $firstImport->assertCreated()
            ->assertJsonPath('imported', 1)
            ->assertJsonPath('skipped', 1)
            ->assertJsonPath('not_imported_rows.0.reason', 'Buchungsdatum liegt vor dem 01.01.2014');

        $this->assertDatabaseHas('bank_transactions', [
            'tenant_id' => $data->tenant->id,
            'amount' => 123456,
            'counterparty' => 'Muster GmbH',
            'status' => 'unmatched',
        ]);

        $secondImport = $this->withHeaders($headers)->post('/api/bank-imports', [
            'bank_account_id' => $data->bankAccount->id,
            'settings' => json_encode($settings),
            'file' => UploadedFile::fake()->createWithContent('konto.csv', $csv),
        ]);

        $secondImport->assertCreated()
            ->assertJsonPath('imported', 0)
            ->assertJsonPath('skipped', 2);

        $batchId = $firstImport->json('batch.id');
        $this->withHeaders($headers)->get("/api/bank-imports/{$batchId}/skipped")
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }

    public function test_invoice_assignment_records_payment_and_unassign_reverses_it(): void
    {
        $data = TenantTestDataFactory::create('bank-invoice');
        $headers = $this->headersFor($data->user);
        $this->withHeaders($headers)->postJson("/api/invoices/{$data->invoice->id}/book")->assertOk();
        $invoice = $data->invoice->fresh();
        $transaction = $this->transaction($data, $invoice->total, "Zahlung {$invoice->invoice_number}");

        $this->withHeaders($headers)->getJson('/api/bank-transactions/suggestions')
            ->assertOk()
            ->assertJsonPath('0.suggestions.0.target_type', 'invoice')
            ->assertJsonPath('0.suggestions.0.target_id', $invoice->id);

        $this->withHeaders($headers)->postJson("/api/bank-transactions/{$transaction->id}/assign", [
            'target_type' => 'invoice',
            'target_id' => $invoice->id,
        ])->assertOk()
            ->assertJsonPath('status', 'matched')
            ->assertJsonPath('matched_type', 'invoice');

        $invoice->refresh();
        $payment = Payment::where('bank_transaction_id', $transaction->id)->firstOrFail();
        $entry = JournalEntry::with('lines')->findOrFail($payment->journal_entry_id);

        $this->assertSame('paid', $invoice->status);
        $this->assertSame((int) $invoice->total, (int) $invoice->amount_paid);
        $this->assertSame('posted', $entry->status);
        $this->assertSame($data->accountBank->id, $entry->lines->where('type', 'debit')->first()->account_id);
        $this->assertDatabaseHas('audit_logs', ['event' => 'bank_tx_assigned', 'auditable_id' => $transaction->id]);

        $this->withHeaders($headers)->postJson("/api/bank-transactions/{$transaction->id}/unassign")
            ->assertOk()
            ->assertJsonPath('status', 'unmatched')
            ->assertJsonPath('matched_type', null);

        $payment->refresh();
        $invoice->refresh();
        $this->assertNotNull($payment->reversed_at);
        $this->assertSame(0, (int) $invoice->amount_paid);
        $this->assertSame('booked', $invoice->status);
    }

    public function test_category_assignment_books_directly_without_learning_category_suggestions(): void
    {
        $data = TenantTestDataFactory::create('bank-category');
        $headers = $this->headersFor($data->user);
        $transaction = $this->transaction($data, -1299, 'Google One Speicher', 'Google Ireland');

        $this->withHeaders($headers)->postJson("/api/bank-transactions/{$transaction->id}/assign", [
            'target_type' => 'category',
            'account_id' => $data->accountExpense->id,
            'project_id' => $data->project->id,
            'cost_center_id' => $data->costCenter->id,
        ])->assertOk()
            ->assertJsonPath('status', 'matched')
            ->assertJsonPath('matched_type', 'category');

        $transaction->refresh();
        $entry = JournalEntry::with('lines')->findOrFail($transaction->journal_entry_id);
        $this->assertSame('posted', $entry->status);
        $expenseLine = $entry->lines->where('type', 'debit')->first();
        $this->assertSame($data->accountExpense->id, $expenseLine->account_id);
        $this->assertSame($data->costCenter->id, $expenseLine->cost_center_id);
        $this->assertSame($data->projectCostObject->id, $expenseLine->cost_object_id);
        $this->assertSame($data->accountBank->id, $entry->lines->where('type', 'credit')->first()->account_id);
        $this->assertDatabaseMissing('bank_matching_rules', [
            'tenant_id' => $data->tenant->id,
            'target_type' => 'category',
            'target_account_id' => $data->accountExpense->id,
        ]);

        $next = $this->transaction($data, -1999, 'Google Workspace', 'Google Ireland');

        $this->withHeaders($headers)->getJson('/api/bank-transactions/suggestions')
            ->assertOk()
            ->assertJsonMissingPath('0.transaction.id');

        $this->assertSame('unmatched', $next->fresh()->status);
    }

    public function test_direct_reversal_of_category_booking_releases_bank_transaction(): void
    {
        $data = TenantTestDataFactory::create('bank-category-direct-reversal');
        $headers = $this->headersFor($data->user);
        $transaction = $this->transaction($data, -1299, 'Google One Speicher', 'Google Ireland');

        $this->withHeaders($headers)->postJson("/api/bank-transactions/{$transaction->id}/assign", [
            'target_type' => 'category',
            'account_id' => $data->accountExpense->id,
        ])->assertOk()
            ->assertJsonPath('status', 'matched');

        $journalEntryId = $transaction->fresh()->journal_entry_id;

        $this->withHeaders($headers)->postJson("/api/bookings/{$journalEntryId}/reverse")
            ->assertCreated();

        $transaction->refresh();
        $this->assertSame('unmatched', $transaction->status);
        $this->assertNull($transaction->matched_type);
        $this->assertNull($transaction->matched_id);
        $this->assertNull($transaction->journal_entry_id);
        $this->assertSame('cancelled', JournalEntry::findOrFail($journalEntryId)->status);
    }

    public function test_direct_reversal_of_payment_booking_releases_bank_transaction_and_reverses_payment(): void
    {
        $data = TenantTestDataFactory::create('bank-payment-direct-reversal');
        $headers = $this->headersFor($data->user);
        $this->withHeaders($headers)->postJson("/api/invoices/{$data->invoice->id}/book")->assertOk();
        $invoice = $data->invoice->fresh();
        $transaction = $this->transaction($data, $invoice->total, "Zahlung {$invoice->invoice_number}");

        $this->withHeaders($headers)->postJson("/api/bank-transactions/{$transaction->id}/assign", [
            'target_type' => 'invoice',
            'target_id' => $invoice->id,
        ])->assertOk()
            ->assertJsonPath('status', 'matched');

        $payment = Payment::where('bank_transaction_id', $transaction->id)->firstOrFail();

        $this->withHeaders($headers)->postJson("/api/bookings/{$payment->journal_entry_id}/reverse")
            ->assertCreated();

        $transaction->refresh();
        $payment->refresh();
        $invoice->refresh();

        $this->assertSame('unmatched', $transaction->status);
        $this->assertNull($transaction->matched_type);
        $this->assertNull($transaction->matched_id);
        $this->assertNull($transaction->journal_entry_id);
        $this->assertNotNull($payment->reversed_at);
        $this->assertNotNull($payment->reversal_journal_entry_id);
        $this->assertSame(0, (int) $invoice->amount_paid);
        $this->assertSame('booked', $invoice->status);
    }

    public function test_payment_reversal_releases_linked_bank_transaction(): void
    {
        $data = TenantTestDataFactory::create('bank-payment-endpoint-reversal');
        $headers = $this->headersFor($data->user);
        $this->withHeaders($headers)->postJson("/api/invoices/{$data->invoice->id}/book")->assertOk();
        $invoice = $data->invoice->fresh();
        $transaction = $this->transaction($data, $invoice->total, "Zahlung {$invoice->invoice_number}");

        $this->withHeaders($headers)->postJson("/api/bank-transactions/{$transaction->id}/assign", [
            'target_type' => 'invoice',
            'target_id' => $invoice->id,
        ])->assertOk()
            ->assertJsonPath('status', 'matched');

        $payment = Payment::where('bank_transaction_id', $transaction->id)->firstOrFail();

        $this->withHeaders($headers)->deleteJson("/api/payments/{$payment->id}")
            ->assertOk();

        $transaction->refresh();
        $payment->refresh();
        $invoice->refresh();

        $this->assertSame('unmatched', $transaction->status);
        $this->assertNull($transaction->matched_type);
        $this->assertNull($transaction->matched_id);
        $this->assertNull($transaction->journal_entry_id);
        $this->assertNotNull($payment->reversed_at);
        $this->assertSame(0, (int) $invoice->amount_paid);
        $this->assertSame('booked', $invoice->status);
    }

    public function test_beleg_suggestion_matches_vendor_and_similar_invoice_purpose_tokens(): void
    {
        $data = TenantTestDataFactory::create('bank-beleg-suggestion');
        $headers = $this->headersFor($data->user);
        $data->vendor->update(['name' => 'Telefonica Germany GmbH + Co. OHG']);

        $beleg = Beleg::create([
            'tenant_id' => $data->tenant->id,
            'document_number' => 'BLG-2026-0052',
            'document_type' => 'eingang',
            'title' => 'Kd-No.: 6117875823 Rg-No.: 1476031258/8 Your Tariff Invoice',
            'document_date' => '2026-02-13',
            'amount' => 1999,
            'tax_amount' => 0,
            'contact_id' => $data->vendor->id,
            'category_account_id' => $data->accountExpense->id,
            'status' => 'booked',
            'amount_paid' => 0,
        ]);
        $transaction = $this->transaction(
            $data,
            -1999,
            'Kd-Nr.: 6117875823 Rg-Nr.: 1476031258/8 Ihre Tarifrechnung',
            'Telefonica Germany GmbH + Co. OHG'
        );

        $suggestions = $this->withHeaders($headers)->getJson('/api/bank-transactions/suggestions')
            ->assertOk()
            ->json();

        $item = collect($suggestions)->firstWhere('transaction.id', $transaction->id);
        $this->assertNotNull($item);
        $this->assertSame('beleg', $item['suggestions'][0]['target_type']);
        $this->assertSame($beleg->id, $item['suggestions'][0]['target_id']);
    }

    public function test_unmatched_bank_transaction_can_be_edited_and_duplicates_are_rejected(): void
    {
        $data = TenantTestDataFactory::create('bank-edit');
        $headers = $this->headersFor($data->user);
        $first = $this->transaction($data, -1000, 'Alt', 'Vendor A');
        $second = $this->transaction($data, -2000, 'Second', 'Vendor B');
        $second->update([
            'fingerprint' => app(BankCsvImportService::class)->fingerprint(
                $data->bankAccount->id,
                $second->booking_date->toDateString(),
                $second->amount,
                $second->purpose,
                $second->counterparty,
            ),
        ]);

        $this->withHeaders($headers)->patchJson("/api/bank-transactions/{$first->id}", [
            'booking_date' => '2026-07-15',
            'value_date' => '2026-07-16',
            'counterparty' => 'Hetzner Online GmbH',
            'purpose' => 'Invoice 123',
            'amount' => -4259,
            'currency' => 'EUR',
            'notes' => 'manuell korrigiert',
        ])->assertOk()
            ->assertJsonPath('counterparty', 'Hetzner Online GmbH')
            ->assertJsonPath('amount', -4259);

        $this->assertDatabaseHas('audit_logs', ['event' => 'bank_tx_updated', 'auditable_id' => $first->id]);

        $second->refresh();
        $this->withHeaders($headers)->patchJson("/api/bank-transactions/{$first->id}", [
            'booking_date' => $second->booking_date->toDateString(),
            'counterparty' => $second->counterparty,
            'purpose' => $second->purpose,
            'amount' => $second->amount,
            'currency' => $second->currency,
        ])->assertStatus(422);
    }

    public function test_cachier_cannot_import_or_assign_bank_transactions(): void
    {
        $data = TenantTestDataFactory::create('bank-role');
        $cachier = User::create([
            'name' => 'Cachier',
            'email' => 'cachier-bank@at-book.test',
            'password' => Hash::make('password'),
            'tenant_id' => $data->tenant->id,
        ]);
        $cachier->assignRole(Role::firstOrCreate(['name' => 'cachier', 'guard_name' => 'api']));
        $headers = $this->headersFor($cachier);
        $transaction = $this->transaction($data, -1000, 'Test');

        $this->withHeaders($headers)->post('/api/bank-imports/preview', [
            'bank_account_id' => $data->bankAccount->id,
            'file' => UploadedFile::fake()->createWithContent('konto.csv', "Datum;Betrag\n01.01.2026;10,00\n"),
        ])->assertForbidden();

        $this->withHeaders($headers)->postJson("/api/bank-transactions/{$transaction->id}/assign", [
            'target_type' => 'category',
            'account_id' => $data->accountExpense->id,
        ])->assertForbidden();
    }

    private function headersFor(User $user): array
    {
        return ['Authorization' => 'Bearer '.auth('api')->login($user)];
    }

    private function transaction(object $data, int $amount, string $purpose, ?string $counterparty = null): BankTransaction
    {
        return BankTransaction::create([
            'tenant_id' => $data->tenant->id,
            'bank_account_id' => $data->bankAccount->id,
            'booking_date' => now()->toDateString(),
            'counterparty' => $counterparty ?? $data->customer->name,
            'purpose' => $purpose,
            'amount' => $amount,
            'currency' => 'EUR',
            'fingerprint' => sha1(uniqid('tx', true)),
            'raw' => ['purpose' => $purpose],
        ]);
    }
}
