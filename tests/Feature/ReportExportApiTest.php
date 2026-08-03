<?php

namespace Tests\Feature;

use App\Jobs\GenerateReportExportJob;
use App\Models\ReportExport;
use App\Modules\Accounting\Reports\Euer\EuerMappingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

class ReportExportApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_export_model_tenant_scoped_and_has_public_id(): void
    {
        $data = TenantTestDataFactory::create('scoped');
        $export = ReportExport::create([
            'tenant_id' => $data->tenant->id,
            'report_type' => 'bwa',
            'format' => 'xlsx',
            'period_from' => '2026-01-01',
            'period_to' => '2026-07-31',
            'basis' => 'posted',
            'status' => 'pending',
        ]);

        $this->assertNotEmpty($export->public_id);
        $this->assertEquals($data->tenant->id, $export->tenant_id);

        // Verify scope filters query
        app()->instance('currentTenant', $data->tenant);
        $this->assertEquals(1, ReportExport::count());

        $otherTenant = TenantTestDataFactory::create('other-scoped');
        app()->instance('currentTenant', $otherTenant->tenant);
        $this->assertEquals(0, ReportExport::count());
    }

    public function test_async_export_flow_and_xlsx_validation(): void
    {
        Storage::fake('local');
        Queue::fake();

        $data = TenantTestDataFactory::create('async-flow');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        app()->instance('currentTenant', $data->tenant);

        // POST creates pending record and dispatches job
        $response = $this->withHeaders($headers)->postJson('/api/reports/bwa/exports', [
            'format' => 'xlsx',
            'from_date' => '2026-01-01',
            'to_date' => '2026-07-31',
            'basis' => 'posted',
        ]);

        $response->assertStatus(202);
        $publicId = $response->json('public_id');
        $this->assertNotEmpty($publicId);
        $this->assertEquals('pending', $response->json('status'));

        Queue::assertPushed(GenerateReportExportJob::class);

        $export = ReportExport::findByPublicIdOrFail($publicId);

        // Run the job synchronously
        Queue::fake(); // reset
        $job = new GenerateReportExportJob($export);
        app()->call([$job, 'handle']);

        $export->refresh();
        $this->assertEquals('ready', $export->status);
        $this->assertNotNull($export->file_path);
        $this->assertGreaterThan(0, $export->file_size);

        // Check file exists in Storage
        Storage::disk('local')->assertExists($export->file_path);

        // Download the file
        $downloadResponse = $this->withHeaders($headers)
            ->get("/api/reports/exports/{$publicId}/download");
        $downloadResponse->assertOk();
        $downloadResponse->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $this->assertStringStartsWith('PK', $downloadResponse->streamedContent());
    }

    public function test_exports_history_index(): void
    {
        $data = TenantTestDataFactory::create('history');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        app()->instance('currentTenant', $data->tenant);

        ReportExport::create([
            'tenant_id' => $data->tenant->id,
            'report_type' => 'bwa',
            'format' => 'xlsx',
            'period_from' => '2026-01-01',
            'period_to' => '2026-07-31',
            'status' => 'ready',
        ]);

        $response = $this->withHeaders($headers)->getJson('/api/reports/exports');
        $response->assertOk();
        $response->assertJsonCount(1);
    }

    public function test_download_gates(): void
    {
        Storage::fake('local');
        $data = TenantTestDataFactory::create('gates');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        app()->instance('currentTenant', $data->tenant);

        $pendingExport = ReportExport::create([
            'tenant_id' => $data->tenant->id,
            'report_type' => 'bwa',
            'format' => 'xlsx',
            'period_from' => '2026-01-01',
            'period_to' => '2026-07-31',
            'status' => 'pending',
        ]);

        $failedExport = ReportExport::create([
            'tenant_id' => $data->tenant->id,
            'report_type' => 'bwa',
            'format' => 'xlsx',
            'period_from' => '2026-01-01',
            'period_to' => '2026-07-31',
            'status' => 'failed',
            'error_message' => 'Something went wrong',
        ]);

        $expiredExport = ReportExport::create([
            'tenant_id' => $data->tenant->id,
            'report_type' => 'bwa',
            'format' => 'xlsx',
            'period_from' => '2026-01-01',
            'period_to' => '2026-07-31',
            'status' => 'ready',
            'file_path' => 'report-exports/1/some.xlsx',
            'expires_at' => now()->subDay(),
        ]);

        // Download pending -> 409
        $this->withHeaders($headers)->get("/api/reports/exports/{$pendingExport->public_id}/download")
            ->assertStatus(409);

        // Download failed -> 400
        $this->withHeaders($headers)->get("/api/reports/exports/{$failedExport->public_id}/download")
            ->assertStatus(400);

        // Download expired -> 410
        $this->withHeaders($headers)->get("/api/reports/exports/{$expiredExport->public_id}/download")
            ->assertStatus(410);
    }

    public function test_tenant_isolation_on_export_access(): void
    {
        $tenantA = TenantTestDataFactory::create('tenant-a');
        $tenantB = TenantTestDataFactory::create('tenant-b');

        $tokenA = auth('api')->login($tenantA->user);
        $headersA = ['Authorization' => "Bearer {$tokenA}"];

        app()->instance('currentTenant', $tenantA->tenant);
        $exportA = ReportExport::create([
            'tenant_id' => $tenantA->tenant->id,
            'report_type' => 'bwa',
            'format' => 'xlsx',
            'period_from' => '2026-01-01',
            'period_to' => '2026-07-31',
            'status' => 'ready',
            'file_path' => 'report-exports/1/some.xlsx',
        ]);

        // Accessing Tenant A export as Tenant B should return 404
        $tokenB = auth('api')->login($tenantB->user);
        $headersB = ['Authorization' => "Bearer {$tokenB}"];

        $this->withHeaders($headersB)->getJson("/api/reports/exports/{$exportA->public_id}")
            ->assertStatus(404);

        $this->withHeaders($headersB)->get("/api/reports/exports/{$exportA->public_id}/download")
            ->assertStatus(404);

        $this->withHeaders($headersB)->deleteJson("/api/reports/exports/{$exportA->public_id}")
            ->assertStatus(404);
    }

    public function test_tax_report_blocking_quality_errors(): void
    {
        Storage::fake('local');
        $data = TenantTestDataFactory::create('blocking');
        $token = auth('api')->login($data->user);
        $headers = ['Authorization' => "Bearer {$token}"];

        app()->instance('currentTenant', $data->tenant);
        app(EuerMappingService::class)->ensureDefaults($data->tenant);

        // Create unmatched bank transaction to trigger EÜR blocker
        DB::table('bank_transactions')->insert([
            'tenant_id' => $data->tenant->id,
            'public_id' => \Illuminate\Support\Str::uuid()->toString(),
            'bank_account_id' => $data->bankAccount->id,
            'booking_date' => '2026-04-12',
            'value_date' => '2026-04-12',
            'amount' => 25000,
            'purpose' => 'Test Blocker',
            'status' => 'unmatched',
            'fingerprint' => 'blocking-test-fingerprint',
            'raw' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $export = ReportExport::create([
            'tenant_id' => $data->tenant->id,
            'report_type' => 'euer',
            'format' => 'xlsx',
            'period_from' => '2026-01-01',
            'period_to' => '2026-07-31',
            'status' => 'pending',
        ]);

        $job = new GenerateReportExportJob($export);
        app()->call([$job, 'handle']);

        $export->refresh();
        $this->assertEquals('failed', $export->status);
        $this->assertStringContainsString('Export blockiert wegen Qualitätsbefunden', $export->error_message);
        $this->assertNull($export->file_path);
    }

    public function test_prune_expired_exports_command(): void
    {
        Storage::fake('local');
        $data = TenantTestDataFactory::create('pruner');
        app()->instance('currentTenant', $data->tenant);

        // 1. Expired export (expires_at in the past)
        $expired = ReportExport::create([
            'tenant_id' => $data->tenant->id,
            'report_type' => 'bwa',
            'format' => 'xlsx',
            'period_from' => '2026-01-01',
            'period_to' => '2026-07-31',
            'status' => 'ready',
            'file_path' => 'report-exports/1/expired.xlsx',
            'expires_at' => now()->subDay(),
        ]);
        Storage::disk('local')->put('report-exports/1/expired.xlsx', 'test');

        // 2. Active export (expires_at in the future)
        $active = ReportExport::create([
            'tenant_id' => $data->tenant->id,
            'report_type' => 'bwa',
            'format' => 'xlsx',
            'period_from' => '2026-01-01',
            'period_to' => '2026-07-31',
            'status' => 'ready',
            'file_path' => 'report-exports/1/active.xlsx',
            'expires_at' => now()->addDay(),
        ]);
        Storage::disk('local')->put('report-exports/1/active.xlsx', 'test');

        $this->assertTrue(Storage::disk('local')->exists('report-exports/1/expired.xlsx'));
        $this->assertTrue(Storage::disk('local')->exists('report-exports/1/active.xlsx'));

        // Run pruner command
        $this->artisan('reports:prune-exports')
            ->assertExitCode(0);

        // Expired should be deleted from DB and storage
        $this->assertDatabaseMissing('report_exports', ['id' => $expired->id]);
        $this->assertFalse(Storage::disk('local')->exists('report-exports/1/expired.xlsx'));

        // Active should still be there in DB and storage
        $this->assertDatabaseHas('report_exports', ['id' => $active->id]);
        $this->assertTrue(Storage::disk('local')->exists('report-exports/1/active.xlsx'));
    }
}
