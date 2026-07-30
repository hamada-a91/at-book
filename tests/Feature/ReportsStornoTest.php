<?php

namespace Tests\Feature;

use App\Models\CompanySetting;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Services\BookingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Regression: Storno-Paare (Generalumkehr) müssen sich in den Berichten zu 0
 * neutralisieren. Vorher wurden cancelled-Originale gefiltert, die Storno-
 * Gegenbuchung aber mitgezählt → negativer Aufwand, zu hoher Gewinn.
 */
class ReportsStornoTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Account $revenue;

    private Account $expense;

    private Account $bank;

    protected function setUp(): void
    {
        parent::setUp();

        $tenant = Tenant::create(['name' => 'Report Test GmbH', 'slug' => 'report-test']);
        $this->user = User::create([
            'name' => 'Tester',
            'email' => 'reports@test.local',
            'password' => bcrypt('password'),
            'tenant_id' => $tenant->id,
        ]);

        app()->instance('currentTenant', $tenant);
        Auth::setUser($this->user); // BookingService nutzt Auth::id()

        CompanySetting::create([
            'company_name' => 'Report Test GmbH',
            'onboarding_completed' => true,
        ]);

        Role::findOrCreate('owner', 'api');
        $this->user->assignRole('owner');

        $this->bank = Account::create(['code' => '1200', 'name' => 'Bank', 'type' => 'asset']);
        $this->revenue = Account::create(['code' => '8400', 'name' => 'Erlöse 19%', 'type' => 'revenue']);
        $this->expense = Account::create(['code' => '4930', 'name' => 'Bürobedarf', 'type' => 'expense']);
    }

    public function test_profit_loss_neutralizes_storno_pairs(): void
    {
        $service = new BookingService;

        // Erlös: 1.190,00 € (festgeschrieben)
        $sale = $service->createBooking([
            'date' => '2026-07-06',
            'description' => 'Barverkauf',
            'lines' => [
                ['account_id' => $this->bank->id, 'type' => 'debit', 'amount' => 119000],
                ['account_id' => $this->revenue->id, 'type' => 'credit', 'amount' => 119000],
            ],
        ]);
        $service->lockBooking($sale->id);

        // Aufwand-Entwurf: 59,50 €
        $service->createBooking([
            'date' => '2026-07-13',
            'description' => 'Büromaterial (Entwurf)',
            'lines' => [
                ['account_id' => $this->expense->id, 'type' => 'debit', 'amount' => 5950],
                ['account_id' => $this->bank->id, 'type' => 'credit', 'amount' => 5950],
            ],
        ]);

        // Aufwand 250,00 € festschreiben und stornieren → muss sich zu 0 neutralisieren
        $wrong = $service->createBooking([
            'date' => '2026-07-09',
            'description' => 'Fehlbuchung',
            'lines' => [
                ['account_id' => $this->expense->id, 'type' => 'debit', 'amount' => 25000],
                ['account_id' => $this->bank->id, 'type' => 'credit', 'amount' => 25000],
            ],
        ]);
        $service->lockBooking($wrong->id);
        $service->reverseBooking($wrong->id);

        $token = auth('api')->login($this->user);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/profit-loss?from_date=2026-07-01&to_date=2026-07-30');

        $response->assertOk();
        $response->assertJson([
            'total_revenue' => 119000,
            'total_expense' => 0,      // basis=posted schließt Entwürfe aus, Storno-Paar neutralisiert
            'net_profit' => 119000,
        ]);

        $expenseRow = collect($response->json('expenses'))->firstWhere('code', '4930');
        $this->assertSame(0, $expenseRow['amount']);
        $this->assertSame('debit', $expenseRow['balance_type']);
    }

    public function test_dashboard_summary_neutralizes_storno_pairs(): void
    {
        $service = new BookingService;

        // Erlös 1.190,00 € (festgeschrieben)
        $sale = $service->createBooking([
            'date' => '2026-07-06',
            'description' => 'Barverkauf',
            'lines' => [
                ['account_id' => $this->bank->id, 'type' => 'debit', 'amount' => 119000],
                ['account_id' => $this->revenue->id, 'type' => 'credit', 'amount' => 119000],
            ],
        ]);
        $service->lockBooking($sale->id);

        // Aufwand-Entwurf 59,50 € – zählt im Dashboard NICHT (nur festgeschriebene)
        $service->createBooking([
            'date' => '2026-07-13',
            'description' => 'Büromaterial (Entwurf)',
            'lines' => [
                ['account_id' => $this->expense->id, 'type' => 'debit', 'amount' => 5950],
                ['account_id' => $this->bank->id, 'type' => 'credit', 'amount' => 5950],
            ],
        ]);

        // Storno-Paar 250,00 € → muss sich neutralisieren
        $wrong = $service->createBooking([
            'date' => '2026-07-09',
            'description' => 'Fehlbuchung',
            'lines' => [
                ['account_id' => $this->expense->id, 'type' => 'debit', 'amount' => 25000],
                ['account_id' => $this->bank->id, 'type' => 'credit', 'amount' => 25000],
            ],
        ]);
        $service->lockBooking($wrong->id);
        $service->reverseBooking($wrong->id);

        $token = auth('api')->login($this->user);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/dashboard/summary?start_date=2026-07-01&end_date=2026-07-31');

        $response->assertOk();
        $response->assertJson([
            'income' => 119000,
            'expenses' => 0,       // Storno neutral, Entwurf zählt nicht
            'profit' => 119000,
        ]);
    }

    public function test_trial_balance_neutralizes_storno_pairs(): void
    {
        $service = new BookingService;

        $wrong = $service->createBooking([
            'date' => '2026-07-09',
            'description' => 'Fehlbuchung',
            'lines' => [
                ['account_id' => $this->expense->id, 'type' => 'debit', 'amount' => 25000],
                ['account_id' => $this->bank->id, 'type' => 'credit', 'amount' => 25000],
            ],
        ]);
        $service->lockBooking($wrong->id);
        $service->reverseBooking($wrong->id);

        $token = auth('api')->login($this->user);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/trial-balance?from_date=2026-07-01&to_date=2026-07-30');

        $response->assertOk();

        // Original (Soll 250) + Storno (Haben 250) → beide Bewegungen sichtbar, Saldo 0
        $expenseRow = collect($response->json('data'))->firstWhere('code', '4930');
        $this->assertNotNull($expenseRow, 'Konto 4930 muss in der SuSa erscheinen');
        $this->assertSame(25000, $expenseRow['total_debit']);
        $this->assertSame(25000, $expenseRow['total_credit']);
        $this->assertSame(0, $expenseRow['balance']);
    }
}
