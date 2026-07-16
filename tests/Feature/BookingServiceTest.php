<?php

namespace Tests\Feature;

use App\Models\CompanySetting;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Services\BookingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

/**
 * Kern-Feature-Test für den BookingService (SPEC-02, Abschnitt 2.2).
 *
 * Prüft: Soll=Haben-Pflicht, Draft-Erstellung, lockBooking() macht
 * unveränderlich (GoBD), reverseBooking() erzeugt korrekte Gegenbuchung
 * (Generalumkehr) und markiert das Original als cancelled.
 */
class BookingServiceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Account $bank;

    private Account $revenue;

    private Account $expense;

    private BookingService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $tenant = Tenant::create(['name' => 'Booking Test GmbH', 'slug' => 'booking-test']);
        $this->user = User::create([
            'name' => 'Buchhalter',
            'email' => 'booking@test.local',
            'password' => bcrypt('password'),
            'tenant_id' => $tenant->id,
        ]);

        app()->instance('currentTenant', $tenant);
        Auth::setUser($this->user); // BookingService nutzt Auth::id()

        CompanySetting::create([
            'company_name' => 'Booking Test GmbH',
            'onboarding_completed' => true,
        ]);

        $this->bank = Account::create(['code' => '1200', 'name' => 'Bank', 'type' => 'asset']);
        $this->revenue = Account::create(['code' => '8400', 'name' => 'Erlöse 19%', 'type' => 'revenue']);
        $this->expense = Account::create(['code' => '4930', 'name' => 'Bürobedarf', 'type' => 'expense']);

        $this->service = new BookingService;
    }

    public function test_unbalanced_booking_throws_exception(): void
    {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/not balanced/i');

        $this->service->createBooking([
            'date' => '2026-07-01',
            'description' => 'Unausgeglichene Buchung',
            'lines' => [
                ['account_id' => $this->expense->id, 'type' => 'debit', 'amount' => 10000],
                ['account_id' => $this->bank->id, 'type' => 'credit', 'amount' => 9000],
            ],
        ]);
    }

    public function test_create_booking_creates_draft(): void
    {
        $entry = $this->service->createBooking([
            'date' => '2026-07-01',
            'description' => 'Büromaterial',
            'lines' => [
                ['account_id' => $this->expense->id, 'type' => 'debit', 'amount' => 5000],
                ['account_id' => $this->bank->id, 'type' => 'credit', 'amount' => 5000],
            ],
        ]);

        $this->assertSame('draft', $entry->status);
        $this->assertNull($entry->locked_at);
        $this->assertCount(2, $entry->lines);
        $this->assertNotNull($entry->public_id);
        $this->assertSame($this->user->id, $entry->user_id);

        $this->assertDatabaseHas('journal_entries', [
            'id' => $entry->id,
            'status' => 'draft',
            'description' => 'Büromaterial',
        ]);
    }

    public function test_lock_booking_sets_locked_at_and_posted_status(): void
    {
        $entry = $this->service->createBooking([
            'date' => '2026-07-01',
            'description' => 'Barverkauf',
            'lines' => [
                ['account_id' => $this->bank->id, 'type' => 'debit', 'amount' => 119000],
                ['account_id' => $this->revenue->id, 'type' => 'credit', 'amount' => 119000],
            ],
        ]);

        $this->assertNull($entry->locked_at);

        $locked = $this->service->lockBooking($entry->id);

        $this->assertSame('posted', $locked->status);
        $this->assertNotNull($locked->locked_at);
    }

    public function test_locking_an_already_locked_booking_throws_exception(): void
    {
        $entry = $this->service->createBooking([
            'date' => '2026-07-01',
            'description' => 'Barverkauf',
            'lines' => [
                ['account_id' => $this->bank->id, 'type' => 'debit', 'amount' => 119000],
                ['account_id' => $this->revenue->id, 'type' => 'credit', 'amount' => 119000],
            ],
        ]);
        $this->service->lockBooking($entry->id);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/already locked/i');

        $this->service->lockBooking($entry->id);
    }

    public function test_reverse_booking_on_draft_throws_exception(): void
    {
        $entry = $this->service->createBooking([
            'date' => '2026-07-01',
            'description' => 'Entwurf',
            'lines' => [
                ['account_id' => $this->expense->id, 'type' => 'debit', 'amount' => 5000],
                ['account_id' => $this->bank->id, 'type' => 'credit', 'amount' => 5000],
            ],
        ]);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/Only locked bookings need reversal/i');

        $this->service->reverseBooking($entry->id);
    }

    public function test_reverse_booking_creates_swapped_counter_booking_and_cancels_original(): void
    {
        $entry = $this->service->createBooking([
            'date' => '2026-07-01',
            'description' => 'Fehlbuchung',
            'lines' => [
                ['account_id' => $this->expense->id, 'type' => 'debit', 'amount' => 25000],
                ['account_id' => $this->bank->id, 'type' => 'credit', 'amount' => 25000],
            ],
        ]);
        $this->service->lockBooking($entry->id);
        $originalPublicId = $entry->public_id;

        $reversal = $this->service->reverseBooking($entry->id);

        // Eigene public_id für die Gegenbuchung (nicht dieselbe wie das Original -
        // HasPublicId::bootHasPublicId nullt public_id bei replicate()).
        $this->assertNotNull($reversal->public_id);
        $this->assertNotSame($originalPublicId, $reversal->public_id);
        $this->assertSame('posted', $reversal->status);
        $this->assertNotNull($reversal->locked_at);
        $this->assertSame('Storno: Fehlbuchung', $reversal->description);

        // Seiten vertauscht (Generalumkehr)
        $originalLines = $entry->lines()->orderBy('account_id')->get();
        $reversalLines = $reversal->lines()->orderBy('account_id')->get();
        $this->assertCount(2, $reversalLines);
        foreach ($originalLines as $i => $originalLine) {
            $reversalLine = $reversalLines[$i];
            $this->assertSame($originalLine->account_id, $reversalLine->account_id);
            $this->assertSame($originalLine->amount, $reversalLine->amount);
            $this->assertNotSame($originalLine->type, $reversalLine->type);
        }

        // Original als cancelled markiert
        $entry->refresh();
        $this->assertSame('cancelled', $entry->status);
    }

    public function test_double_reverse_throws_exception(): void
    {
        $entry = $this->service->createBooking([
            'date' => '2026-07-01',
            'description' => 'Fehlbuchung',
            'lines' => [
                ['account_id' => $this->expense->id, 'type' => 'debit', 'amount' => 25000],
                ['account_id' => $this->bank->id, 'type' => 'credit', 'amount' => 25000],
            ],
        ]);
        $this->service->lockBooking($entry->id);
        $this->service->reverseBooking($entry->id);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/already been reversed/i');

        $this->service->reverseBooking($entry->id);
    }
}
