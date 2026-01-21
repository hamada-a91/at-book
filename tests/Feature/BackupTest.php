<?php

namespace Tests\Feature;

use App\Models\BackupAuditLog;
use App\Models\BackupJob;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Backup\BackupExportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BackupTest extends TestCase
{
    use RefreshDatabase;

    protected Tenant $tenant;
    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        // Create tenant and user
        $this->tenant = Tenant::factory()->create();
        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'password' => bcrypt('password123'),
        ]);
        
        // Assign owner role if roles exist
        try {
            if (class_exists(\Spatie\Permission\Models\Role::class)) {
                $role = \Spatie\Permission\Models\Role::firstOrCreate(
                    ['name' => 'owner', 'guard_name' => 'api']
                );
                $this->user->assignRole($role);
            }
        } catch (\Exception $e) {
            // Ignore role assignment errors in tests
        }
    }

    protected function tearDown(): void
    {
        // Clean up any created backups
        try {
            Storage::disk('local')->deleteDirectory('backups');
            Storage::disk('local')->deleteDirectory('backup_uploads');
        } catch (\Exception $e) {
            // Ignore cleanup errors
        }
        
        parent::tearDown();
    }

    public function test_backup_job_can_be_created(): void
    {
        $job = BackupJob::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'type' => BackupJob::TYPE_EXPORT,
            'status' => BackupJob::STATUS_PENDING,
        ]);

        $this->assertDatabaseHas('backup_jobs', [
            'tenant_id' => $this->tenant->id,
            'type' => BackupJob::TYPE_EXPORT,
            'status' => BackupJob::STATUS_PENDING,
        ]);

        $this->assertNotNull($job->public_id);
    }

    public function test_backup_job_has_public_id(): void
    {
        $job = BackupJob::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'type' => BackupJob::TYPE_EXPORT,
            'status' => BackupJob::STATUS_PENDING,
        ]);

        $this->assertNotNull($job->public_id);
        $this->assertIsString($job->public_id);
        $this->assertEquals(36, strlen($job->public_id)); // UUID length
    }

    public function test_backup_job_status_transitions(): void
    {
        $job = BackupJob::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'type' => BackupJob::TYPE_EXPORT,
            'status' => BackupJob::STATUS_PENDING,
        ]);

        // Mark as processing
        $job->markAsProcessing('Starting...');
        $this->assertEquals(BackupJob::STATUS_PROCESSING, $job->status);
        $this->assertEquals('Starting...', $job->current_step);
        $this->assertNotNull($job->started_at);

        // Update progress
        $job->updateProgress(50, 'Halfway there...');
        $this->assertEquals(50, $job->progress_percent);
        $this->assertEquals('Halfway there...', $job->current_step);

        // Mark as completed
        $job->markAsCompleted('path/to/file.zip', 1024, 'abc123', ['items' => 100]);
        $this->assertEquals(BackupJob::STATUS_COMPLETED, $job->status);
        $this->assertEquals('path/to/file.zip', $job->file_path);
        $this->assertEquals(1024, $job->file_size);
        $this->assertEquals(['items' => 100], $job->stats);
        $this->assertNotNull($job->completed_at);
    }

    public function test_backup_job_can_be_marked_as_failed(): void
    {
        $job = BackupJob::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'type' => BackupJob::TYPE_EXPORT,
            'status' => BackupJob::STATUS_PROCESSING,
        ]);

        $job->markAsFailed('Something went wrong', ['exception' => 'RuntimeException']);
        
        $this->assertEquals(BackupJob::STATUS_FAILED, $job->status);
        $this->assertEquals('Something went wrong', $job->error_message);
        $this->assertEquals(['exception' => 'RuntimeException'], $job->error_details);
    }

    public function test_backup_job_scopes(): void
    {
        BackupJob::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'type' => BackupJob::TYPE_EXPORT,
            'status' => BackupJob::STATUS_COMPLETED,
        ]);

        BackupJob::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'type' => BackupJob::TYPE_IMPORT,
            'status' => BackupJob::STATUS_PENDING,
        ]);

        BackupJob::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'type' => BackupJob::TYPE_EXPORT,
            'status' => BackupJob::STATUS_PROCESSING,
        ]);

        $this->assertEquals(2, BackupJob::exports()->count());
        $this->assertEquals(1, BackupJob::imports()->count());
        $this->assertEquals(1, BackupJob::completed()->count());
        $this->assertEquals(1, BackupJob::pending()->count());
        $this->assertEquals(1, BackupJob::processing()->count());
    }

    public function test_backup_job_is_running_check(): void
    {
        $pendingJob = BackupJob::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'type' => BackupJob::TYPE_EXPORT,
            'status' => BackupJob::STATUS_PENDING,
        ]);

        $processingJob = BackupJob::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'type' => BackupJob::TYPE_EXPORT,
            'status' => BackupJob::STATUS_PROCESSING,
        ]);

        $completedJob = BackupJob::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'type' => BackupJob::TYPE_EXPORT,
            'status' => BackupJob::STATUS_COMPLETED,
        ]);

        $this->assertTrue($pendingJob->isRunning());
        $this->assertTrue($processingJob->isRunning());
        $this->assertFalse($completedJob->isRunning());
    }

    public function test_backup_audit_log_can_be_created(): void
    {
        $job = BackupJob::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
            'type' => BackupJob::TYPE_EXPORT,
            'status' => BackupJob::STATUS_PENDING,
        ]);

        BackupAuditLog::log(BackupAuditLog::ACTION_EXPORT_STARTED, $job, ['test' => true]);

        $this->assertDatabaseHas('backup_audit_logs', [
            'tenant_id' => $this->tenant->id,
            'backup_job_id' => $job->id,
            'action' => BackupAuditLog::ACTION_EXPORT_STARTED,
        ]);
    }

    public function test_tenant_factory_creates_valid_tenant(): void
    {
        $tenant = Tenant::factory()->create();

        $this->assertNotNull($tenant->id);
        $this->assertNotNull($tenant->name);
        $this->assertNotNull($tenant->slug);
        $this->assertNotNull($tenant->public_id);
    }

    public function test_backup_job_factory_creates_valid_job(): void
    {
        $job = BackupJob::factory()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
        ]);

        $this->assertNotNull($job->id);
        $this->assertNotNull($job->public_id);
        $this->assertContains($job->type, [BackupJob::TYPE_EXPORT, BackupJob::TYPE_IMPORT]);
    }

    public function test_backup_job_factory_states(): void
    {
        $pendingJob = BackupJob::factory()->pending()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
        ]);
        $this->assertEquals(BackupJob::STATUS_PENDING, $pendingJob->status);

        $completedJob = BackupJob::factory()->completed()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
        ]);
        $this->assertEquals(BackupJob::STATUS_COMPLETED, $completedJob->status);
        $this->assertNotNull($completedJob->file_path);

        $failedJob = BackupJob::factory()->failed()->create([
            'tenant_id' => $this->tenant->id,
            'user_id' => $this->user->id,
        ]);
        $this->assertEquals(BackupJob::STATUS_FAILED, $failedJob->status);
        $this->assertNotNull($failedJob->error_message);
    }

    public function test_export_service_can_create_job(): void
    {
        /** @var BackupExportService $exportService */
        $exportService = app(BackupExportService::class);

        $job = $exportService->createExport($this->tenant, $this->user, [
            'include_files' => true,
        ]);

        $this->assertInstanceOf(BackupJob::class, $job);
        $this->assertEquals(BackupJob::TYPE_EXPORT, $job->type);
        $this->assertEquals(BackupJob::STATUS_PENDING, $job->status);
        $this->assertEquals($this->tenant->id, $job->tenant_id);
    }
}
