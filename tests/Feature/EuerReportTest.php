<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\Tenant;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Reports\Euer\EuerMappingService;
use App\Modules\Accounting\Services\BookingService;
use App\Modules\Accounting\Services\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

class EuerReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_euer_zu_abfluss_golden_master(): void
    {
        $data = TenantTestDataFactory::create('euer-gm');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        // Seed EÜR mappings
        app(EuerMappingService::class)->ensureDefaults($data->tenant);

        // Adjust dates for invoice: invoice_date in 2025, paid in 2026
        $data->invoice->update([
            'invoice_date' => '2025-12-15',
            'due_date' => '2025-12-31',
        ]);
        // Update lines so they reference the updated date
        $data->invoice->lines()->update(['created_at' => '2025-12-15 00:00:00']);

        // Book invoice (accrual date: 2025-12-15)
        $this->withHeaders($headers)->postJson("/api/invoices/{$data->invoice->id}/book")->assertOk();

        // Record payment in 2026 (cash flow date: 2026-01-10)
        app(PaymentService::class)->recordPayment(
            $data->invoice->fresh(),
            $data->invoice->total,
            '2026-01-10',
            $data->accountBank->id
        );

        // EÜR for 2025: should be empty/zero
        $response2025 = $this->withHeaders($headers)
            ->getJson('/api/reports/euer?from_date=2025-01-01&to_date=2025-12-31');
        $response2025->assertOk();
        $this->assertSame(0, $response2025->json('totals.total_revenue'));
        $this->assertSame(0, $response2025->json('totals.net_profit'));

        // EÜR for 2026: should contain the full payment
        $response2026 = $this->withHeaders($headers)
            ->getJson('/api/reports/euer?from_date=2026-01-01&to_date=2026-07-31');
        $response2026->assertOk();

        $this->assertSame($data->invoice->total, $response2026->json('totals.total_revenue'));
        $this->assertSame($data->invoice->total, $response2026->json('totals.net_profit'));

        // Verify rows and herleitung
        $rows = collect($response2026->json('data.rows'))->keyBy('zeile');
        $this->assertTrue(isset($rows['betriebseinnahmen']));
        $this->assertSame($data->invoice->subtotal, $rows['betriebseinnahmen']['amount']);
        $this->assertSame($data->invoice->tax_total, $rows['ust_einnahmen']['amount']);

        $this->assertCount(1, $rows['betriebseinnahmen']['herleitung']); // grouped revenue line
    }

    public function test_euer_teilzahlung_proportional_allocation(): void
    {
        $data = TenantTestDataFactory::create('euer-tz');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        app(EuerMappingService::class)->ensureDefaults($data->tenant);

        // Book invoice (total: 119,00 EUR / 119000 Cents)
        // Subtotal: 100,00 EUR, Tax: 19,00 EUR
        $data->invoice->lines()->delete();
        $data->invoice->lines()->create([
            'description' => 'Musterdienstleistung',
            'quantity' => 1,
            'unit_price' => 100000,
            'tax_rate' => 19,
            'line_total' => 100000,
            'account_id' => $data->accountRevenue->id,
        ]);
        $data->invoice->update([
            'subtotal' => 100000,
            'tax_total' => 19000,
            'total' => 119000,
            'invoice_date' => '2026-01-05',
        ]);

        $this->withHeaders($headers)->postJson("/api/invoices/{$data->invoice->id}/book")->assertOk();

        // Partial payment of exactly half: 59,50 EUR (59500 Cents)
        app(PaymentService::class)->recordPayment(
            $data->invoice->fresh(),
            59500,
            '2026-01-10',
            $data->accountBank->id
        );

        $response = $this->withHeaders($headers)
            ->getJson('/api/reports/euer?from_date=2026-01-01&to_date=2026-07-31');
        $response->assertOk();

        // 59.50 EUR should be split: 50.00 EUR net + 9.50 EUR tax
        $this->assertSame(59500, $response->json('totals.total_revenue'));
        $this->assertSame(59500, $response->json('totals.net_profit'));

        $rows = collect($response->json('data.rows'))->keyBy('zeile');
        $this->assertSame(50000, $rows['betriebseinnahmen']['amount']);
        $this->assertSame(9500, $rows['ust_einnahmen']['amount']);
    }

    public function test_euer_negativer_fluss(): void
    {
        $data = TenantTestDataFactory::create('euer-neg');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        app(EuerMappingService::class)->ensureDefaults($data->tenant);

        // Book invoice
        $this->withHeaders($headers)->postJson("/api/invoices/{$data->invoice->id}/book")->assertOk();

        // Refresh model to pick up journal_entry_id
        $data->invoice->refresh();

        // Record a negative payment flow (e.g. refund/reversal value)
        $payment = Payment::create([
            'tenant_id' => $data->tenant->id,
            'payable_type' => 'invoice',
            'payable_id' => $data->invoice->id,
            'amount' => -10000,
            'payment_date' => '2026-01-15',
            'payment_account_id' => $data->accountBank->id,
            'journal_entry_id' => $data->invoice->journal_entry_id,
            'public_id' => \Illuminate\Support\Str::uuid()->toString(),
        ]);

        $response = $this->withHeaders($headers)
            ->getJson('/api/reports/euer?from_date=2026-01-01&to_date=2026-07-31');
        $response->assertOk();

        $this->assertSame(-10000, $response->json('totals.total_revenue'));
        $rows = collect($response->json('data.rows'))->keyBy('zeile');
        $this->assertTrue($rows['betriebseinnahmen']['amount'] < 0);
    }

    public function test_euer_direkter_barbeleg(): void
    {
        $data = TenantTestDataFactory::create('euer-bar');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        app(EuerMappingService::class)->ensureDefaults($data->tenant);

        // Resolve account 4910 (which is in default EÜR mappings)
        $expenseAccount = Account::where('tenant_id', $data->tenant->id)->where('code', '4910')->firstOrFail();

        // Create direct cash Beleg in 2026
        $beleg = \App\Models\Beleg::create([
            'tenant_id' => $data->tenant->id,
            'document_number' => 'BAR-001',
            'document_type' => 'eingang',
            'title' => 'Direktkauf Bürobedarf',
            'document_date' => '2026-02-15',
            'amount' => 11900,
            'tax_amount' => 1900,
            'contact_id' => null, // NO contact -> direct cash
            'category_account_id' => $expenseAccount->id,
            'is_paid' => true,
            'payment_account_id' => $data->accountBank->id,
            'status' => 'draft',
        ]);
        $beleg->lines()->create([
            'description' => 'Portokosten',
            'quantity' => 1,
            'unit_price' => 10000,
            'tax_rate' => 19,
            'line_total' => 10000,
            'account_id' => $expenseAccount->id,
        ]);

        $this->withHeaders($headers)->postJson("/api/belege/{$beleg->id}/book")->assertOk();

        $response = $this->withHeaders($headers)
            ->getJson('/api/reports/euer?from_date=2026-01-01&to_date=2026-07-31');
        $response->assertOk();

        // 11.90 EUR should be split: 10.00 EUR net + 1.90 EUR tax
        $this->assertSame(11900, $response->json('totals.total_expense'));
        $this->assertSame(-11900, $response->json('totals.net_profit'));

        $rows = collect($response->json('data.rows'))->keyBy('zeile');
        $this->assertSame(10000, $rows['sonstige_ausgaben']['amount']);
        $this->assertSame(1900, $rows['ust_ausgaben']['amount']);
    }

    public function test_euer_aveur_blocker(): void
    {
        $data = TenantTestDataFactory::create('euer-aveur');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        app(EuerMappingService::class)->ensureDefaults($data->tenant);

        // Create asset account starting with 0 (e.g. 0400 Pkw)
        $assetAccount = Account::create([
            'tenant_id' => $data->tenant->id,
            'code' => '0400',
            'name' => 'Fuhrpark',
            'type' => 'asset',
        ]);

        // Post a movement on class 0 account in 2026
        Auth::setUser($data->user);
        (new BookingService)->createBooking([
            'date' => '2026-03-10',
            'description' => 'Kauf Pkw',
            'lines' => [
                ['account_id' => $assetAccount->id, 'type' => 'debit', 'amount' => 500000],
                ['account_id' => $data->accountBank->id, 'type' => 'credit', 'amount' => 500000],
            ],
        ], autoLock: true);

        // EÜR should be blocked on transfer-sheet and have quality status error
        $response = $this->withHeaders($headers)
            ->getJson('/api/reports/euer?from_date=2026-01-01&to_date=2026-07-31');
        $response->assertOk();

        $quality = $response->json('quality');
        $this->assertSame('error', $quality['status']);
        $this->assertTrue(collect($quality['blocking_errors'])->contains('code', 'aveur_missing_asset_register'));

        // Requesting transfer-sheet should throw 422
        $this->withHeaders($headers)
            ->getJson('/api/reports/euer/transfer-sheet?year=2026&month=3&format=pdf')
            ->assertStatus(422);
    }

    public function test_euer_equity_class0_account_does_not_trigger_aveur_blocker(): void
    {
        $data = TenantTestDataFactory::create('euer-equity');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        app(EuerMappingService::class)->ensureDefaults($data->tenant);

        // SKR03-Kapitalkonto in Klasse 0, aber type=equity (KEIN Anlagevermögen)
        $equityAccount = Account::withoutGlobalScopes()->firstOrCreate(
            ['tenant_id' => $data->tenant->id, 'code' => '0820'],
            ['name' => 'Kapitalrücklage', 'type' => 'equity']
        );

        Auth::setUser($data->user);
        (new BookingService)->createBooking([
            'date' => '2026-03-10',
            'description' => 'Kapitaleinlage',
            'lines' => [
                ['account_id' => $data->accountBank->id, 'type' => 'debit', 'amount' => 500000],
                ['account_id' => $equityAccount->id, 'type' => 'credit', 'amount' => 500000],
            ],
        ], autoLock: true);

        $response = $this->withHeaders($headers)
            ->getJson('/api/reports/euer?from_date=2026-01-01&to_date=2026-07-31');
        $response->assertOk();

        // Eigenkapital-Buchung darf den AVEÜR-Blocker NICHT auslösen
        $this->assertFalse(
            collect($response->json('quality.blocking_errors'))->contains('code', 'aveur_missing_asset_register')
        );
    }

    public function test_euer_unmatched_bank_transactions_blocker(): void
    {
        $data = TenantTestDataFactory::create('euer-bank');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        app(EuerMappingService::class)->ensureDefaults($data->tenant);

        // Create an unmatched bank transaction in 2026
        DB::table('bank_transactions')->insert([
            'tenant_id' => $data->tenant->id,
            'public_id' => \Illuminate\Support\Str::uuid()->toString(),
            'bank_account_id' => $data->bankAccount->id,
            'booking_date' => '2026-04-12',
            'value_date' => '2026-04-12',
            'amount' => 25000,
            'purpose' => 'Test',
            'status' => 'unmatched',
            'fingerprint' => 'test-fingerprint',
            'raw' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->withHeaders($headers)
            ->getJson('/api/reports/euer?from_date=2026-01-01&to_date=2026-07-31');
        $response->assertOk();

        $quality = $response->json('quality');
        $this->assertSame('error', $quality['status']);
        $this->assertTrue(collect($quality['blocking_errors'])->contains('code', 'euer_unmatched_bank_transactions'));
    }

    public function test_euer_exports_and_disclaimer(): void
    {
        $data = TenantTestDataFactory::create('euer-exports');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        app(EuerMappingService::class)->ensureDefaults($data->tenant);

        // Export PDF
        $pdf = $this->withHeaders($headers)
            ->get('/api/reports/euer/export?from_date=2026-01-01&to_date=2026-07-31&format=pdf');
        $pdf->assertOk();
        $this->assertStringContainsString('application/pdf', $pdf->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $pdf->getContent());

        // Export CSV
        $csv = $this->withHeaders($headers)
            ->get('/api/reports/euer/export?from_date=2026-01-01&to_date=2026-07-31&format=csv');
        $csv->assertOk();
        $this->assertStringContainsString('text/csv', $csv->headers->get('content-type'));
        $this->assertStringContainsString('EÜR Eingabehilfe', $csv->streamedContent());
    }

    public function test_euer_tenant_isolation(): void
    {
        $dataA = TenantTestDataFactory::create('euer-iso-a');
        $dataB = TenantTestDataFactory::create('euer-iso-b');

        app(EuerMappingService::class)->ensureDefaults($dataA->tenant);
        app(EuerMappingService::class)->ensureDefaults($dataB->tenant);

        // Book invoice A in 2026
        Auth::setUser($dataA->user);
        app()->instance('currentTenant', $dataA->tenant);
        $dataA->invoice->update(['invoice_date' => '2026-01-05']);
        $dataA->invoice->lines()->update(['created_at' => '2026-01-05 00:00:00']);
        $tokenA = auth('api')->login($dataA->user);
        $this->withHeader('Authorization', "Bearer {$tokenA}")
            ->postJson("/api/invoices/{$dataA->invoice->id}/book")
            ->assertOk();
        app(PaymentService::class)->recordPayment($dataA->invoice->fresh(), 11900, '2026-01-10', $dataA->accountBank->id);

        // Book invoice B in 2026
        Auth::setUser($dataB->user);
        app()->instance('currentTenant', $dataB->tenant);
        $dataB->invoice->update(['invoice_date' => '2026-01-05']);
        $dataB->invoice->lines()->update(['created_at' => '2026-01-05 00:00:00']);
        $tokenB = auth('api')->login($dataB->user);
        $this->withHeader('Authorization', "Bearer {$tokenB}")
            ->postJson("/api/invoices/{$dataB->invoice->id}/book")
            ->assertOk();
        app(PaymentService::class)->recordPayment($dataB->invoice->fresh(), 23800, '2026-01-10', $dataB->accountBank->id);

        // Fetch EÜR for Tenant A
        $this->actingAs($dataA->user, 'api');
        app()->instance('currentTenant', $dataA->tenant);
        $responseA = $this->getJson('/api/reports/euer?from_date=2026-01-01&to_date=2026-07-31');
        $responseA->assertOk();
        $this->assertSame(11900, $responseA->json('totals.total_revenue'));

        // Fetch EÜR for Tenant B
        $this->actingAs($dataB->user, 'api');
        app()->instance('currentTenant', $dataB->tenant);
        $responseB = $this->getJson('/api/reports/euer?from_date=2026-01-01&to_date=2026-07-31');
        $responseB->assertOk();
        $this->assertSame(23800, $responseB->json('totals.total_revenue'));
    }
}
