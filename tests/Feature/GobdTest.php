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
 * GoBD-Regeln: Ist-Zustand testen (SPEC-02, Abschnitt 2.2).
 *
 * WICHTIG (gemäß Aufgabenstellung): Wo eine Durchsetzungslücke gefunden
 * wird, wird HIER KEINE neue Enforcement-Logik implementiert (gehört zu
 * SPEC-04) - stattdessen markTestSkipped() mit Begründung. Alle Lücken
 * sind zusätzlich im Abschlussbericht aufgeführt.
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
     * DURCHSETZUNGSLÜCKE: Eine festgeschriebene (locked_at gesetzt) Buchung
     * lässt sich weiterhin per direktem Model-Update ändern - es gibt
     * weder einen Observer noch eine DB-Constraint, die das verhindert.
     * BookingService prüft locked_at nur innerhalb von lockBooking()
     * selbst, nicht bei generischen Model-Updates. Wird in SPEC-04
     * behoben (siehe docs/specs/SPEC-04-buchungslogik.md).
     */
    public function test_locked_journal_entry_can_still_be_updated_directly_via_model(): void
    {
        $this->markTestSkipped('Enforcement fehlt, wird in SPEC-04 umgesetzt: gelockte JournalEntry-Models lassen sich per direktem Model-Update weiterhin ändern (kein Observer/Guard).');

        $entry = $this->service->createBooking([
            'date' => '2026-07-01',
            'description' => 'Barverkauf',
            'lines' => [
                ['account_id' => $this->bank->id, 'type' => 'debit', 'amount' => 10000],
                ['account_id' => $this->expense->id, 'type' => 'credit', 'amount' => 10000],
            ],
        ]);
        $this->service->lockBooking($entry->id);

        $entry->update(['description' => 'Nachträglich geändert']);

        $this->assertSame('Nachträglich geändert', $entry->fresh()->description);
    }

    /**
     * DURCHSETZUNGSLÜCKE: InvoiceController::book() setzt bei der erzeugten
     * JournalEntry den Status zwar auf 'posted', aber NICHT locked_at (siehe
     * CLAUDE.md, "Bekannte Fallen": "InvoiceController::book() bucht ohne
     * Transaktion und ohne locked_at"). Damit ist eine über die Rechnung
     * gebuchte Journalbuchung GoBD-technisch NICHT festgeschrieben, obwohl
     * sie als 'posted' erscheint - inkonsistent zu BookingService::lockBooking().
     * Wird in SPEC-04 behoben.
     */
    public function test_invoice_booking_leaves_locked_at_null_despite_posted_status(): void
    {
        $this->markTestSkipped('Enforcement fehlt, wird in SPEC-04 umgesetzt: InvoiceController::book() setzt locked_at nicht, obwohl status=posted gesetzt wird (siehe CLAUDE.md "Bekannte Fallen").');

        $data = TenantTestDataFactory::create('gobdinv');

        $token = $this->tokenFor($data->user);
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/invoices/{$data->invoice->id}/book")
            ->assertOk();

        $journalEntry = \App\Modules\Accounting\Models\JournalEntry::findOrFail($data->invoice->fresh()->journal_entry_id);

        $this->assertSame('posted', $journalEntry->status);
        $this->assertNull($journalEntry->locked_at, 'Erwartungsgemäß NICHT gesetzt - genau das ist die Lücke.');
    }
}
