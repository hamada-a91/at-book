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

class ReportsCoreExportTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Account $bank;

    private Account $equity;

    private Account $revenue;

    private Account $expense;

    private Account $vat;

    private Account $inputVat;

    protected function setUp(): void
    {
        parent::setUp();

        [$this->user, $this->bank, $this->equity, $this->revenue, $this->expense, $this->vat, $this->inputVat] = $this->tenantFixture('reports-a', 'Reports A GmbH');
    }

    public function test_golden_master_core_reports_and_basis_rules(): void
    {
        $this->bookGoldenMaster($this->user, $this->bank, $this->equity, $this->revenue, $this->expense, $this->vat, $this->inputVat);
        $token = auth('api')->login($this->user);

        $postedPl = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/profit-loss?from_date=2026-01-01&to_date=2026-01-31');
        $postedPl->assertOk()->assertJsonPath('basis', 'posted');
        $this->assertSame(10000, $postedPl->json('total_revenue'));
        $this->assertSame(5000, $postedPl->json('total_expense'));
        $this->assertSame(5000, $postedPl->json('net_profit'));

        $previewPl = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/profit-loss?from_date=2026-01-01&to_date=2026-01-31&basis=preview');
        $previewPl->assertOk()->assertJsonPath('quality.status', 'warning');
        $this->assertSame(7500, $previewPl->json('total_expense'));
        $this->assertSame(2500, $previewPl->json('net_profit'));

        $trialBalance = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/trial-balance?from_date=2026-01-01&to_date=2026-01-31');
        $trialBalance->assertOk();
        $this->assertSame($trialBalance->json('totals.period_debit'), $trialBalance->json('totals.period_credit'));
        $bankRow = collect($trialBalance->json('data'))->firstWhere('code', '1200');
        $this->assertSame(100000, $bankRow['opening_balance']);
        $this->assertSame(105950, $bankRow['closing_balance']);

        $balanceSheet = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/balance-sheet?from_date=2026-01-01&to_date=2026-01-31');
        $balanceSheet->assertOk();
        $this->assertSame(5000, $balanceSheet->json('totals.difference'));
        $balanceSheet->assertJsonPath('quality.status', 'warning');

        $vat = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/vat?from_date=2026-01-01&to_date=2026-01-31');
        $vat->assertOk();
        $this->assertSame(1900, $vat->json('totals.output_tax'));
        $this->assertSame(950, $vat->json('totals.input_tax'));
        $this->assertSame(950, $vat->json('totals.tax_payable'));
    }

    public function test_reports_are_tenant_isolated_with_same_account_codes(): void
    {
        $this->bookGoldenMaster($this->user, $this->bank, $this->equity, $this->revenue, $this->expense, $this->vat, $this->inputVat);
        [$otherUser, $otherBank, $otherEquity, $otherRevenue, $otherExpense, $otherVat, $otherInputVat] = $this->tenantFixture('reports-b', 'Reports B GmbH');
        $this->bookGoldenMaster($otherUser, $otherBank, $otherEquity, $otherRevenue, $otherExpense, $otherVat, $otherInputVat, revenueNet: 20000);

        $token = auth('api')->login($this->user);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/profit-loss?from_date=2026-01-01&to_date=2026-01-31');

        $response->assertOk();
        $this->assertSame(10000, $response->json('total_revenue'));
    }

    public function test_pdf_and_csv_exports_download(): void
    {
        $this->bookGoldenMaster($this->user, $this->bank, $this->equity, $this->revenue, $this->expense, $this->vat, $this->inputVat);
        $token = auth('api')->login($this->user);

        $pdf = $this->withHeader('Authorization', "Bearer {$token}")
            ->get('/api/reports/profit-loss/export?from_date=2026-01-01&to_date=2026-01-31&format=pdf');
        $pdf->assertOk();
        $this->assertStringContainsString('application/pdf', $pdf->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $pdf->getContent());

        $csv = $this->withHeader('Authorization', "Bearer {$token}")
            ->get('/api/reports/profit-loss/export?from_date=2026-01-01&to_date=2026-01-31&format=csv');
        $csv->assertOk();
        $this->assertStringContainsString('text/csv', $csv->headers->get('content-type'));
        $this->assertStringContainsString('profit_loss', $csv->streamedContent());
    }

    /**
     * @return array{0: User, 1: Account, 2: Account, 3: Account, 4: Account, 5: Account, 6: Account}
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

        return [
            $user,
            Account::create(['code' => '1200', 'name' => 'Bank', 'type' => 'asset']),
            Account::create(['code' => '0800', 'name' => 'Eigenkapital', 'type' => 'equity']),
            Account::create(['code' => '8400', 'name' => 'Erlöse 19%', 'type' => 'revenue']),
            Account::create(['code' => '4930', 'name' => 'Bürobedarf', 'type' => 'expense']),
            Account::create(['code' => '1776', 'name' => 'Umsatzsteuer 19%', 'type' => 'liability']),
            Account::create(['code' => '1576', 'name' => 'Vorsteuer 19%', 'type' => 'asset']),
        ];
    }

    private function bookGoldenMaster(User $user, Account $bank, Account $equity, Account $revenue, Account $expense, Account $vat, Account $inputVat, int $revenueNet = 10000): void
    {
        app()->instance('currentTenant', $user->tenant);
        Auth::setUser($user);
        $service = new BookingService;

        $service->createBooking([
            'date' => '2025-12-31',
            'description' => 'Eröffnung',
            'lines' => [
                ['account_id' => $bank->id, 'type' => 'debit', 'amount' => 100000],
                ['account_id' => $equity->id, 'type' => 'credit', 'amount' => 100000],
            ],
        ], autoLock: true);

        $tax = (int) round($revenueNet * 0.19);
        $service->createBooking([
            'date' => '2026-01-10',
            'description' => 'Erlös 19%',
            'lines' => [
                ['account_id' => $bank->id, 'type' => 'debit', 'amount' => $revenueNet + $tax],
                ['account_id' => $revenue->id, 'type' => 'credit', 'amount' => $revenueNet, 'tax_key' => 'UST19', 'tax_amount' => $tax],
                ['account_id' => $vat->id, 'type' => 'credit', 'amount' => $tax],
            ],
        ], autoLock: true);

        $service->createBooking([
            'date' => '2026-01-12',
            'description' => 'Aufwand 19%',
            'lines' => [
                ['account_id' => $expense->id, 'type' => 'debit', 'amount' => 5000, 'tax_key' => 'VST19', 'tax_amount' => 950],
                ['account_id' => $inputVat->id, 'type' => 'debit', 'amount' => 950],
                ['account_id' => $bank->id, 'type' => 'credit', 'amount' => 5950],
            ],
        ], autoLock: true);

        $wrong = $service->createBooking([
            'date' => '2026-01-15',
            'description' => 'Storno-Test',
            'lines' => [
                ['account_id' => $expense->id, 'type' => 'debit', 'amount' => 3000],
                ['account_id' => $bank->id, 'type' => 'credit', 'amount' => 3000],
            ],
        ], autoLock: true);
        $service->reverseBooking($wrong->id);

        $service->createBooking([
            'date' => '2026-01-20',
            'description' => 'Draft Aufwand',
            'lines' => [
                ['account_id' => $expense->id, 'type' => 'debit', 'amount' => 2500],
                ['account_id' => $bank->id, 'type' => 'credit', 'amount' => 2500],
            ],
        ]);
    }
}
