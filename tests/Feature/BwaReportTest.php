<?php

namespace Tests\Feature;

use App\Models\CompanySetting;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Reports\Bwa\BwaMappingService;
use App\Modules\Accounting\Services\BookingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class BwaReportTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    /** @var array<string, Account> */
    private array $accounts;

    protected function setUp(): void
    {
        parent::setUp();

        [$this->user, $this->accounts] = $this->tenantFixture('bwa-a', 'BWA A GmbH');
    }

    public function test_bwa_golden_master_with_ytd_and_previous_year(): void
    {
        $this->bookBwaFixture($this->user, $this->accounts);
        $token = auth('api')->login($this->user);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/bwa?from_date=2026-01-01&to_date=2026-01-31');

        $response->assertOk()->assertJsonPath('report_type', 'bwa');
        $this->assertSame(10000, $response->json('totals.revenue'));
        $this->assertSame(6000, $response->json('totals.costs'));
        $this->assertSame(7000, $response->json('totals.gross_profit'));
        $this->assertSame(4000, $response->json('totals.operating_result'));

        $rows = collect($response->json('data.rows'))->keyBy('code');
        $this->assertSame(10000, $rows['revenue']['month_value']);
        $this->assertSame(8000, $rows['revenue']['previous_year_value']);
        $this->assertSame(2000, $rows['revenue']['deviation_amount']);
        $this->assertEqualsWithDelta(25.0, $rows['revenue']['deviation_percent'], 0.01);
        $this->assertSame(3000, $rows['material']['month_value']);
        $this->assertSame(7000, $rows['gross_profit']['month_value']);
        $this->assertSame(4000, $rows['operating_result']['year_to_date_value']);
    }

    public function test_bwa_warns_about_unmapped_active_income_statement_account(): void
    {
        $this->bookBwaFixture($this->user, $this->accounts);
        $unmapped = Account::create(['code' => '9999', 'name' => 'Nicht gemappt', 'type' => 'expense']);
        $this->book($this->user, '2026-01-25', [
            ['account_id' => $unmapped->id, 'type' => 'debit', 'amount' => 1234],
            ['account_id' => $this->accounts['bank']->id, 'type' => 'credit', 'amount' => 1234],
        ]);

        $token = auth('api')->login($this->user);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/bwa?from_date=2026-01-01&to_date=2026-01-31');

        $response->assertOk()->assertJsonPath('quality.status', 'warning');
        $warning = collect($response->json('quality.warnings'))->firstWhere('code', 'bwa_unmapped_active_accounts');
        $this->assertSame(1, $warning['affected_count']);
        $this->assertSame('9999', $warning['drilldown'][0]['code']);
    }

    public function test_bwa_is_tenant_isolated(): void
    {
        $this->bookBwaFixture($this->user, $this->accounts);
        [$otherUser, $otherAccounts] = $this->tenantFixture('bwa-b', 'BWA B GmbH');
        $this->bookBwaFixture($otherUser, $otherAccounts, revenue: 25000);

        $token = auth('api')->login($this->user);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/bwa?from_date=2026-01-01&to_date=2026-01-31');

        $response->assertOk();
        $this->assertSame(10000, $response->json('totals.revenue'));
    }

    public function test_bwa_pdf_and_csv_exports_download(): void
    {
        $this->bookBwaFixture($this->user, $this->accounts);
        $token = auth('api')->login($this->user);

        $pdf = $this->withHeader('Authorization', "Bearer {$token}")
            ->get('/api/reports/bwa/export?from_date=2026-01-01&to_date=2026-01-31&format=pdf');
        $pdf->assertOk();
        $this->assertStringContainsString('application/pdf', $pdf->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $pdf->getContent());

        $csv = $this->withHeader('Authorization', "Bearer {$token}")
            ->get('/api/reports/bwa/export?from_date=2026-01-01&to_date=2026-01-31&format=csv');
        $csv->assertOk();
        $this->assertStringContainsString('text/csv', $csv->headers->get('content-type'));
        $this->assertStringContainsString('BWA', $csv->streamedContent());
    }

    /**
     * @return array{0: User, 1: array<string, Account>}
     */
    private function tenantFixture(string $slug, string $name): array
    {
        $tenant = Tenant::create(['name' => $name, 'slug' => $slug]);
        app()->instance('currentTenant', $tenant);

        $user = User::create([
            'name' => $name.' User',
            'email' => $slug.'@test.local',
            'password' => bcrypt('password'),
            'tenant_id' => $tenant->id,
        ]);

        CompanySetting::create(['company_name' => $name, 'onboarding_completed' => true]);
        Role::findOrCreate('owner', 'api');
        $user->assignRole('owner');

        $accounts = [
            'bank' => Account::create(['code' => '1200', 'name' => 'Bank', 'type' => 'asset']),
            'equity' => Account::create(['code' => '0800', 'name' => 'Eigenkapital', 'type' => 'equity']),
            'revenue' => Account::create(['code' => '8400', 'name' => 'Erlöse 19%', 'type' => 'revenue']),
            'material' => Account::create(['code' => '3400', 'name' => 'Wareneingang', 'type' => 'expense']),
            'personnel' => Account::create(['code' => '4120', 'name' => 'Gehälter', 'type' => 'expense']),
            'advertising' => Account::create(['code' => '4930', 'name' => 'Bürobedarf', 'type' => 'expense']),
        ];
        app(BwaMappingService::class)->ensureDefaults($tenant);

        return [$user, $accounts];
    }

    /**
     * @param  array<string, Account>  $accounts
     */
    private function bookBwaFixture(User $user, array $accounts, int $revenue = 10000): void
    {
        $this->book($user, '2025-01-10', [
            ['account_id' => $accounts['bank']->id, 'type' => 'debit', 'amount' => 8000],
            ['account_id' => $accounts['revenue']->id, 'type' => 'credit', 'amount' => 8000],
        ]);
        $this->book($user, '2025-01-12', [
            ['account_id' => $accounts['material']->id, 'type' => 'debit', 'amount' => 2000],
            ['account_id' => $accounts['bank']->id, 'type' => 'credit', 'amount' => 2000],
        ]);
        $this->book($user, '2026-01-10', [
            ['account_id' => $accounts['bank']->id, 'type' => 'debit', 'amount' => $revenue],
            ['account_id' => $accounts['revenue']->id, 'type' => 'credit', 'amount' => $revenue],
        ]);
        $this->book($user, '2026-01-12', [
            ['account_id' => $accounts['material']->id, 'type' => 'debit', 'amount' => 3000],
            ['account_id' => $accounts['bank']->id, 'type' => 'credit', 'amount' => 3000],
        ]);
        $this->book($user, '2026-01-13', [
            ['account_id' => $accounts['personnel']->id, 'type' => 'debit', 'amount' => 2000],
            ['account_id' => $accounts['bank']->id, 'type' => 'credit', 'amount' => 2000],
        ]);
        $this->book($user, '2026-01-14', [
            ['account_id' => $accounts['advertising']->id, 'type' => 'debit', 'amount' => 1000],
            ['account_id' => $accounts['bank']->id, 'type' => 'credit', 'amount' => 1000],
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $lines
     */
    private function book(User $user, string $date, array $lines): void
    {
        app()->instance('currentTenant', $user->tenant);
        Auth::setUser($user);
        (new BookingService)->createBooking([
            'date' => $date,
            'description' => 'BWA Test',
            'lines' => $lines,
        ], autoLock: true);
    }
}
