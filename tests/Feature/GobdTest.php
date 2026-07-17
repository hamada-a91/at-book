<?php

namespace Tests\Feature;

use App\Models\CompanySetting;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Services\BookingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

/**
 * GoBD-Regeln (SPEC-02, Abschnitt 2.2 + SPEC-04, Abschnitt 4.5).
 *
 * Die beiden zuvor als Durchsetzungslücke markierten Tests (per
 * markTestSkipped() geparkt) sind seit SPEC-04 aktiv: JournalEntry/
 * JournalEntryLine sperren festgeschriebene Buchungen gegen Update/Delete
 * (Ausnahme: der Storno-Statuswechsel durch BookingService::reverseBooking()),
 * und InvoiceController::book() schreibt über InvoiceBookingService sofort fest.
 */
class GobdTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Account $bank;

    private Account $expense;

    private BookingService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $tenant = Tenant::create(['name' => 'GoBD Test GmbH', 'slug' => 'gobd-test']);
        $this->user = User::create([
            'name' => 'Buchhalter',
            'email' => 'gobd@test.local',
            'password' => bcrypt('password'),
            'tenant_id' => $tenant->id,
        ]);

        app()->instance('currentTenant', $tenant);
        Auth::setUser($this->user);

        CompanySetting::create([
            'company_name' => 'GoBD Test GmbH',
            'onboarding_completed' => true,
        ]);

        $this->bank = Account::create(['code' => '1200', 'name' => 'Bank', 'type' => 'asset']);
        $this->expense = Account::create(['code' => '4930', 'name' => 'Bürobedarf', 'type' => 'expense']);

        $this->service = new BookingService;
    }

    private function tokenFor(User $user): string
    {
        return auth('api')->login($user);
    }

    /**
     * Korrekt durchgesetzte GoBD-Regel: ein Entwurf (nicht gelockt) kann
     * nicht storniert werden - Storno ist nur für festgeschriebene
     * Buchungen sinnvoll (Drafts werden stattdessen gelöscht/verworfen).
     */
    public function test_reversing_a_draft_booking_via_api_returns_422(): void
    {
        $draft = $this->service->createBooking([
            'date' => '2026-07-01',
            'description' => 'Entwurf',
            'lines' => [
                ['account_id' => $this->expense->id, 'type' => 'debit', 'amount' => 5000],
                ['account_id' => $this->bank->id, 'type' => 'credit', 'amount' => 5000],
            ],
        ]);

        $token = $this->tokenFor($this->user);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/bookings/{$draft->id}/reverse");

        $response->assertStatus(422);
    }

    /**
     * Korrekt durchgesetzte GoBD-Regel: eine bereits festgeschriebene
     * Buchung kann nicht ein zweites Mal festgeschrieben werden.
     */
    public function test_locking_an_already_locked_booking_via_api_returns_422(): void
    {
        $entry = $this->service->createBooking([
            'date' => '2026-07-01',
            'description' => 'Barverkauf',
            'lines' => [
                ['account_id' => $this->bank->id, 'type' => 'debit', 'amount' => 10000],
                ['account_id' => $this->expense->id, 'type' => 'credit', 'amount' => 10000],
            ],
        ]);
        $this->service->lockBooking($entry->id);

        $token = $this->tokenFor($this->user);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/bookings/{$entry->id}/lock");

        $response->assertStatus(422);
    }

    /**
     * SPEC-04 (4.5): GoBD-Enforcement jetzt aktiv. Eine festgeschriebene
     * (locked_at gesetzt) Buchung lässt sich NICHT mehr per direktem
     * Model-Update ändern - JournalEntry::booted() wirft eine
     * DomainException im 'updating'-Hook. Die einzige erlaubte Ausnahme ist
     * der Statuswechsel auf 'cancelled' durch BookingService::reverseBooking()
     * (separat in BookingServiceTest abgedeckt). Ursprünglich war dies eine
     * dokumentierte Durchsetzungslücke (siehe CLAUDE.md, "Bekannte Fallen").
     */
    public function test_locked_journal_entry_can_still_be_updated_directly_via_model(): void
    {
        $entry = $this->service->createBooking([
            'date' => '2026-07-01',
            'description' => 'Barverkauf',
            'lines' => [
                ['account_id' => $this->bank->id, 'type' => 'debit', 'amount' => 10000],
                ['account_id' => $this->expense->id, 'type' => 'credit', 'amount' => 10000],
            ],
        ]);
        $this->service->lockBooking($entry->id);
        $entry->refresh(); // lockBooking() setzt locked_at auf einer neuen Instanz - lokale Referenz nachziehen

        $this->expectException(\DomainException::class);
        $this->expectExceptionMessageMatches('/kann nicht geändert werden/i');

        $entry->update(['description' => 'Nachträglich geändert']);
    }

    /**
     * SPEC-04 (4.1): InvoiceController::book() bucht jetzt über
     * InvoiceBookingService::bookInvoice(), die die erzeugte JournalEntry
     * im selben Aufruf per BookingService::lockBooking() festschreibt.
     * Ursprünglich blieb locked_at trotz status='posted' NULL (siehe
     * CLAUDE.md, "Bekannte Fallen": "InvoiceController::book() bucht ohne
     * Transaktion und ohne locked_at").
     */
    public function test_invoice_booking_leaves_locked_at_null_despite_posted_status(): void
    {
        $data = TenantTestDataFactory::create('gobdinv');

        $token = $this->tokenFor($data->user);
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/invoices/{$data->invoice->id}/book")
            ->assertOk();

        $journalEntry = \App\Modules\Accounting\Models\JournalEntry::findOrFail($data->invoice->fresh()->journal_entry_id);

        $this->assertSame('posted', $journalEntry->status);
        $this->assertNotNull($journalEntry->locked_at, 'Rechnungsbuchungen müssen ab SPEC-04 sofort festgeschrieben (GoBD) werden.');
    }
}
