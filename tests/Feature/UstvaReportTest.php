<?php

namespace Tests\Feature;

use App\Models\CompanySetting;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Reports\Ustva\UstvaMappingService;
use App\Modules\Accounting\Services\BookingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class UstvaReportTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    /** @var array<string, Account> */
    private array $accounts;

    protected function setUp(): void
    {
        parent::setUp();

        [$this->user, $this->accounts] = $this->tenantFixture('ustva-a', 'UStVA A GmbH');
    }

    public function test_golden_master_derives_ustva_kennziffern_and_sources(): void
    {
        $this->bookSale19($this->user, 1000000, 190000);
        $this->bookPurchaseWithInputTax($this->user, 200000, 38000);
        $this->lockPeriod($this->user);
        $token = auth('api')->login($this->user);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/ustva?year=2026&month=1');

        $response->assertOk()->assertJsonPath('quality.status', 'ok');
        $rows = collect($response->json('data.kennziffern'))->keyBy('kennziffer');
        $this->assertSame(1000000, $rows['81']['amount']);
        $this->assertSame(190000, $rows['81']['tax_amount']);
        $this->assertSame(38000, $rows['66']['amount']);
        $this->assertSame(152000, $rows['83']['amount']);
        $this->assertSame('8400', $rows['81']['herleitung'][0]['account_code']);
        $this->assertSame('1576', $rows['66']['herleitung'][0]['account_code']);
    }

    public function test_nullmeldung_returns_zero_kennziffern_with_ok_quality(): void
    {
        $this->lockPeriod($this->user);
        $token = auth('api')->login($this->user);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/ustva?year=2026&month=1');

        $response->assertOk()->assertJsonPath('quality.status', 'ok');
        $rows = collect($response->json('data.kennziffern'))->keyBy('kennziffer');
        $this->assertSame(0, $rows['81']['amount']);
        $this->assertSame(0, $rows['66']['amount']);
        $this->assertSame(0, $rows['83']['amount']);
    }

    public function test_input_tax_above_output_tax_returns_negative_kz_83(): void
    {
        $this->bookSale19($this->user, 10000, 1900);
        $this->bookPurchaseWithInputTax($this->user, 50000, 9500);
        $this->lockPeriod($this->user);
        $token = auth('api')->login($this->user);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/ustva?year=2026&month=1');

        $response->assertOk();
        $rows = collect($response->json('data.kennziffern'))->keyBy('kennziffer');
        $this->assertSame(-7600, $rows['83']['amount']);
    }

    public function test_unsupported_tax_key_blocks_transfer_sheet(): void
    {
        $this->book($this->user, '2026-01-18', [
            ['account_id' => $this->accounts['bank']->id, 'type' => 'debit', 'amount' => 10000],
            ['account_id' => $this->accounts['revenue19']->id, 'type' => 'credit', 'amount' => 10000, 'tax_key' => 'RC13B'],
        ]);
        $token = auth('api')->login($this->user);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/ustva?year=2026&month=1');
        $response->assertOk()->assertJsonPath('quality.status', 'error');
        $this->assertSame('ustva_unsupported_tax_key', $response->json('quality.blocking_errors.0.code'));

        $sheet = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/ustva/transfer-sheet?year=2026&month=1&format=csv');
        $sheet->assertStatus(422);
    }

    public function test_preview_basis_and_drafts_block_transfer_sheet(): void
    {
        $this->book($this->user, '2026-01-20', [
            ['account_id' => $this->accounts['bank']->id, 'type' => 'debit', 'amount' => 11900],
            ['account_id' => $this->accounts['revenue19']->id, 'type' => 'credit', 'amount' => 10000],
            ['account_id' => $this->accounts['vat19']->id, 'type' => 'credit', 'amount' => 1900],
        ], autoLock: false);
        $token = auth('api')->login($this->user);

        $preview = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/ustva?year=2026&month=1&basis=preview');
        $preview->assertOk()->assertJsonPath('quality.status', 'error');
        $this->assertContains('vat_requires_posted_basis', collect($preview->json('quality.blocking_errors'))->pluck('code')->all());
        $this->assertContains('ustva_open_drafts', collect($preview->json('quality.blocking_errors'))->pluck('code')->all());

        $sheet = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/ustva/transfer-sheet?year=2026&month=1&basis=preview&format=csv');
        $sheet->assertStatus(422);
    }

    public function test_transfer_sheet_pdf_and_csv_download_without_submission_words(): void
    {
        $this->bookSale19($this->user, 10000, 1900);
        $this->lockPeriod($this->user);
        $token = auth('api')->login($this->user);

        $pdf = $this->withHeader('Authorization', "Bearer {$token}")
            ->get('/api/reports/ustva/transfer-sheet?year=2026&month=1&format=pdf');
        $pdf->assertOk();
        $this->assertStringContainsString('application/pdf', $pdf->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $pdf->getContent());

        $csv = $this->withHeader('Authorization', "Bearer {$token}")
            ->get('/api/reports/ustva/transfer-sheet?year=2026&month=1&format=csv');
        $csv->assertOk();
        $body = $csv->streamedContent();
        $this->assertStringContainsString('USt-VA Eingabehilfe', $body);
        $this->assertStringNotContainsString('gesendet', $body);
        $this->assertStringNotContainsString('übermittelt', $body);
    }

    public function test_ustva_is_tenant_isolated_with_same_account_codes(): void
    {
        $this->bookSale19($this->user, 10000, 1900);
        $this->lockPeriod($this->user);
        [$otherUser] = $this->tenantFixture('ustva-b', 'UStVA B GmbH');
        $this->bookSale19($otherUser, 50000, 9500);
        $this->lockPeriod($otherUser);
        $token = auth('api')->login($this->user);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/ustva?year=2026&month=1');

        $response->assertOk();
        $rows = collect($response->json('data.kennziffern'))->keyBy('kennziffer');
        $this->assertSame(10000, $rows['81']['amount']);
    }

    private function lockPeriod(User $user): void
    {
        app()->instance('currentTenant', $user->tenant);
        CompanySetting::query()->firstOrFail()->update(['books_locked_until' => '2026-01-31']);
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

        CompanySetting::create([
            'company_name' => $name,
            'tax_number' => '12/345/67890',
            'onboarding_completed' => true,
        ]);
        Role::findOrCreate('owner', 'api');
        $user->assignRole('owner');

        $accounts = [
            'bank' => Account::create(['code' => '1200', 'name' => 'Bank', 'type' => 'asset']),
            'revenue19' => Account::create(['code' => '8400', 'name' => 'Erlöse 19%', 'type' => 'revenue']),
            'revenue7' => Account::create(['code' => '8300', 'name' => 'Erlöse 7%', 'type' => 'revenue']),
            'expense' => Account::create(['code' => '4930', 'name' => 'Bürobedarf', 'type' => 'expense']),
            'vat19' => Account::create(['code' => '1776', 'name' => 'Umsatzsteuer 19%', 'type' => 'liability']),
            'vat7' => Account::create(['code' => '1771', 'name' => 'Umsatzsteuer 7%', 'type' => 'liability']),
            'inputVat19' => Account::create(['code' => '1576', 'name' => 'Vorsteuer 19%', 'type' => 'asset']),
            'inputVat7' => Account::create(['code' => '1571', 'name' => 'Vorsteuer 7%', 'type' => 'asset']),
        ];
        app(UstvaMappingService::class)->ensureDefaults($tenant);

        return [$user, $accounts];
    }

    private function bookSale19(User $user, int $net, int $tax): void
    {
        app()->instance('currentTenant', $user->tenant);
        $accounts = $this->accountsForTenant($user->tenant);
        $this->book($user, '2026-01-10', [
            ['account_id' => $accounts['bank']->id, 'type' => 'debit', 'amount' => $net + $tax],
            ['account_id' => $accounts['revenue19']->id, 'type' => 'credit', 'amount' => $net, 'tax_key' => 'UST19', 'tax_amount' => $tax],
            ['account_id' => $accounts['vat19']->id, 'type' => 'credit', 'amount' => $tax],
        ]);
    }

    private function bookPurchaseWithInputTax(User $user, int $net, int $tax): void
    {
        app()->instance('currentTenant', $user->tenant);
        $accounts = $this->accountsForTenant($user->tenant);
        $this->book($user, '2026-01-12', [
            ['account_id' => $accounts['expense']->id, 'type' => 'debit', 'amount' => $net, 'tax_key' => 'VST19', 'tax_amount' => $tax],
            ['account_id' => $accounts['inputVat19']->id, 'type' => 'debit', 'amount' => $tax],
            ['account_id' => $accounts['bank']->id, 'type' => 'credit', 'amount' => $net + $tax],
        ]);
    }

    /**
     * @return array<string, Account>
     */
    private function accountsForTenant(Tenant $tenant): array
    {
        return Account::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereIn('code', ['1200', '8400', '8300', '4930', '1776', '1771', '1576', '1571'])
            ->get()
            ->keyBy(fn (Account $account) => match ($account->code) {
                '1200' => 'bank',
                '8400' => 'revenue19',
                '8300' => 'revenue7',
                '4930' => 'expense',
                '1776' => 'vat19',
                '1771' => 'vat7',
                '1576' => 'inputVat19',
                '1571' => 'inputVat7',
            })
            ->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $lines
     */
    private function book(User $user, string $date, array $lines, bool $autoLock = true): void
    {
        app()->instance('currentTenant', $user->tenant);
        Auth::setUser($user);
        (new BookingService)->createBooking([
            'date' => $date,
            'description' => 'USt-VA Test',
            'lines' => $lines,
        ], autoLock: $autoLock);
    }
}
