<?php

namespace Tests\Feature;

use App\Models\CompanySetting;
use App\Models\Invoice;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Services\BookingService;
use App\Modules\Contacts\Models\Contact;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SPEC-05 (Teil B): Periodenfestschreibung (Monatsabschluss) - Akzeptanzkriterien.
 */
class PeriodLockTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    private User $owner;

    private Account $bank;

    private Account $expense;

    private BookingService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create(['name' => 'Period Lock GmbH', 'slug' => 'period-lock']);
        $this->owner = User::create([
            'name' => 'Owner',
            'email' => 'owner@period-lock.test',
            'password' => bcrypt('password'),
            'tenant_id' => $this->tenant->id,
        ]);
        $this->owner->assignRole(Role::firstOrCreate(['name' => 'owner', 'guard_name' => 'api']));

        app()->instance('currentTenant', $this->tenant);
        Auth::setUser($this->owner);

        CompanySetting::create(['company_name' => 'Period Lock GmbH', 'onboarding_completed' => true]);

        $this->bank = Account::create(['code' => '1200', 'name' => 'Bank', 'type' => 'asset']);
        $this->expense = Account::create(['code' => '4930', 'name' => 'Bürobedarf', 'type' => 'expense']);

        $this->service = new BookingService;
    }

    private function tokenFor(User $user): string
    {
        return auth('api')->login($user);
    }

    private function draft(string $date, string $description = 'Testbuchung'): JournalEntry
    {
        return $this->service->createBooking([
            'date' => $date,
            'description' => $description,
            'lines' => [
                ['account_id' => $this->expense->id, 'type' => 'debit', 'amount' => 1000],
                ['account_id' => $this->bank->id, 'type' => 'credit', 'amount' => 1000],
            ],
        ]);
    }

    public function test_lock_period_locks_only_drafts_up_to_date_in_order(): void
    {
        $d1 = $this->draft('2026-05-10', 'Mai früh');
        $d2 = $this->draft('2026-05-20', 'Mai spät');
        $d3 = $this->draft('2026-06-05', 'Juni (bleibt offen)');

        $token = $this->tokenFor($this->owner);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/bookings/lock-period', ['until_date' => '2026-05-31']);

        $response->assertOk();
        $response->assertJson(['locked_count' => 2, 'books_locked_until' => '2026-05-31']);

        $d1->refresh();
        $d2->refresh();
        $d3->refresh();

        $this->assertSame('posted', $d1->status);
        $this->assertSame('posted', $d2->status);
        $this->assertSame('draft', $d3->status, 'Buchungen NACH dem Stichtag müssen draft bleiben.');

        // Lückenlose journal_number in Datumsreihenfolge (d1 vor d2, da früheres Datum).
        $this->assertNotNull($d1->journal_number);
        $this->assertNotNull($d2->journal_number);
        $this->assertNull($d3->journal_number, 'Nicht festgeschriebene Buchungen dürfen keine journal_number haben.');

        preg_match('/(\d+)$/', $d1->journal_number, $m1);
        preg_match('/(\d+)$/', $d2->journal_number, $m2);
        $this->assertSame((int) $m1[1] + 1, (int) $m2[1], 'journal_number muss lückenlos in Datumsreihenfolge vergeben werden.');
    }

    public function test_new_booking_in_locked_period_returns_422_manual(): void
    {
        $token = $this->tokenFor($this->owner);
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/bookings/lock-period', ['until_date' => '2026-05-31'])
            ->assertOk();

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/bookings', [
                'date' => '2026-05-15',
                'description' => 'Zu spät erfasst',
                'lines' => [
                    ['account_id' => $this->expense->id, 'type' => 'debit', 'amount' => 1000],
                    ['account_id' => $this->bank->id, 'type' => 'credit', 'amount' => 1000],
                ],
            ]);

        $response->assertStatus(422);
        $response->assertJsonFragment([
            'error' => 'Der Zeitraum bis 31.05.2026 ist festgeschrieben – Buchung im offenen Zeitraum erfassen.',
        ]);
    }

    public function test_new_invoice_booking_in_locked_period_returns_422(): void
    {
        $customerAccount = Account::create(['code' => '10001', 'name' => 'Debitor', 'type' => 'asset']);
        $customer = Contact::create([
            'name' => 'Kunde',
            'type' => 'customer',
            'customer_account_id' => $customerAccount->id,
        ]);

        $invoice = Invoice::create([
            'invoice_number' => 'RE-2026-9001',
            'contact_id' => $customer->id,
            'invoice_date' => '2026-05-15',
            'due_date' => '2026-05-29',
            'status' => 'draft',
            'subtotal' => 10000,
            'tax_total' => 1900,
            'total' => 11900,
        ]);
        $invoice->lines()->create([
            'description' => 'Testposition',
            'quantity' => 1,
            'unit' => 'Stück',
            'unit_price' => 10000,
            'tax_rate' => 19,
            'line_total' => 10000,
            'account_id' => $this->expense->id,
        ]);

        $token = $this->tokenFor($this->owner);
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/bookings/lock-period', ['until_date' => '2026-05-31'])
            ->assertOk();

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/invoices/{$invoice->id}/book");

        $response->assertStatus(422);
        $invoice->refresh();
        $this->assertSame('draft', $invoice->status, 'Rechnung darf bei gesperrter Periode nicht gebucht werden.');
    }

    public function test_lock_period_before_current_locked_until_returns_422(): void
    {
        $token = $this->tokenFor($this->owner);
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/bookings/lock-period', ['until_date' => '2026-05-31'])
            ->assertOk();

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/bookings/lock-period', ['until_date' => '2026-05-15']);

        $response->assertStatus(422);
    }

    public function test_reverse_booking_from_locked_period_keeps_original_and_reverses_in_open_period(): void
    {
        $entry = $this->draft('2026-05-10', 'Fehlbuchung');
        $this->service->lockBooking($entry->id);

        $token = $this->tokenFor($this->owner);
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/bookings/lock-period', ['until_date' => '2026-05-31'])
            ->assertOk();

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/bookings/{$entry->id}/reverse");

        $response->assertCreated();
        $reversalData = $response->json();

        $entry->refresh();
        $this->assertSame('cancelled', $entry->status);
        $this->assertSame('2026-05-10', $entry->booking_date->toDateString(), 'Original-Buchungsdatum bleibt unverändert.');

        $reversalDate = Carbon::parse($reversalData['booking_date']);
        $this->assertTrue(
            $reversalDate->gt(Carbon::parse('2026-05-31')),
            'Die Storno-Buchung muss im offenen Zeitraum liegen (nach books_locked_until).'
        );
        $this->assertStringContainsString('Storno zu Buchung vom 10.05.2026', $reversalData['description']);
        $this->assertNotNull($reversalData['journal_number'], 'Storno bekommt eine eigene journal_number.');
        $this->assertNotSame($entry->journal_number, $reversalData['journal_number']);

        // GuV neutral: Summe je Konto über Original + Storno = 0 (Beträge identisch,
        // Soll/Haben vertauscht - reverseBooking() garantiert das strukturell).
        $reversal = JournalEntry::with('lines')->find($reversalData['id']);
        $originalLines = $entry->lines()->orderBy('account_id')->get();
        $reversalLines = $reversal->lines()->orderBy('account_id')->get();
        foreach ($originalLines as $i => $originalLine) {
            $this->assertSame($originalLine->account_id, $reversalLines[$i]->account_id);
            $this->assertSame($originalLine->amount, $reversalLines[$i]->amount);
            $this->assertNotSame($originalLine->type, $reversalLines[$i]->type);
        }
    }

    public function test_cachier_gets_403_on_lock_period(): void
    {
        $cachier = User::create([
            'name' => 'Kassierer',
            'email' => 'cachier@period-lock.test',
            'password' => bcrypt('password'),
            'tenant_id' => $this->tenant->id,
        ]);
        $cachier->assignRole(Role::firstOrCreate(['name' => 'cachier', 'guard_name' => 'api']));

        $token = $this->tokenFor($cachier);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/bookings/lock-period', ['until_date' => '2026-05-31']);

        $response->assertStatus(403);
    }

    public function test_buchhalter_may_lock_period(): void
    {
        $buchhalter = User::create([
            'name' => 'Buchhalterin',
            'email' => 'buchhalter@period-lock.test',
            'password' => bcrypt('password'),
            'tenant_id' => $this->tenant->id,
        ]);
        $buchhalter->assignRole(Role::firstOrCreate(['name' => 'buchhalter', 'guard_name' => 'api']));

        $token = $this->tokenFor($buchhalter);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/bookings/lock-period', ['until_date' => '2026-05-31']);

        $response->assertOk();
    }

    public function test_lock_status_reports_gobd_deadline_exceeded_for_old_drafts(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-17'));

        try {
            // Vorvormonat (Mai) relativ zu "heute" 17.07.2026 -> Vormonat=Juni, davor=Mai.
            $this->draft('2026-05-10', 'Alter Entwurf');

            $token = $this->tokenFor($this->owner);
            $response = $this->withHeader('Authorization', "Bearer {$token}")
                ->getJson('/api/bookings/lock-status');

            $response->assertOk();
            $response->assertJson([
                'open_drafts_count' => 1,
                'oldest_open_draft_date' => '2026-05-10',
                'gobd_deadline_exceeded' => true,
            ]);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_lock_status_not_exceeded_for_previous_month_draft(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-17'));

        try {
            // Vormonat (Juni) - noch innerhalb der Kulanzfrist.
            $this->draft('2026-06-15', 'Entwurf Vormonat');

            $token = $this->tokenFor($this->owner);
            $response = $this->withHeader('Authorization', "Bearer {$token}")
                ->getJson('/api/bookings/lock-status');

            $response->assertOk();
            $response->assertJson(['gobd_deadline_exceeded' => false]);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_lock_period_of_tenant_a_does_not_affect_tenant_b(): void
    {
        $tenantB = Tenant::create(['name' => 'Tenant B', 'slug' => 'period-lock-b']);
        $userB = User::create([
            'name' => 'Owner B',
            'email' => 'owner-b@period-lock.test',
            'password' => bcrypt('password'),
            'tenant_id' => $tenantB->id,
        ]);
        $userB->assignRole(Role::firstOrCreate(['name' => 'owner', 'guard_name' => 'api']));

        app()->instance('currentTenant', $tenantB);
        Auth::setUser($userB);
        CompanySetting::create(['company_name' => 'Tenant B', 'onboarding_completed' => true]);
        $bankB = Account::create(['code' => '1200', 'name' => 'Bank', 'type' => 'asset']);
        $expenseB = Account::create(['code' => '4930', 'name' => 'Bürobedarf', 'type' => 'expense']);
        $serviceB = new BookingService;
        $draftB = $serviceB->createBooking([
            'date' => '2026-05-10',
            'description' => 'Tenant B Entwurf',
            'lines' => [
                ['account_id' => $expenseB->id, 'type' => 'debit', 'amount' => 1000],
                ['account_id' => $bankB->id, 'type' => 'credit', 'amount' => 1000],
            ],
        ], $userB->id);

        // Zurück zu Tenant A für den lock-period-Call.
        app()->instance('currentTenant', $this->tenant);
        Auth::setUser($this->owner);
        $draftA = $this->draft('2026-05-10', 'Tenant A Entwurf');

        $token = $this->tokenFor($this->owner);
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/bookings/lock-period', ['until_date' => '2026-05-31'])
            ->assertOk();

        $draftA->refresh();
        $draftB->refresh();

        $this->assertSame('posted', $draftA->status);
        $this->assertSame('draft', $draftB->status, "Tenant B's Entwurf darf von Tenant A's lock-period nicht betroffen sein.");
    }
}
