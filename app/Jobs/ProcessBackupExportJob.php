<?php

namespace App\Jobs;

use App\Models\BackupJob;
use App\Services\Backup\BackupExportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;

class ProcessBackupExportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 3600; // 1 hour

    /**
     * The backup job to process.
     */
    protected BackupJob $backupJob;

    /**
     * Create a new job instance.
     */
    public function __construct(BackupJob $backupJob)
    {
        $this->backupJob = $backupJob;
        $this->onQueue('backups');
    }

    /**
     * Get the middleware the job should pass through.
     */
    public function middleware(): array
    {
        // Prevent multiple exports for the same tenant at once
        return [
            (new WithoutOverlapping($this->backupJob->tenant_id))
                ->releaseAfter(60)
                ->expireAfter(3600),
        ];
    }

    /**
     * Execute the job.
     */
    public function handle(BackupExportService $exportService): void
    {
        $exportService->processExport($this->backupJob);
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        $this->backupJob->markAsFailed(
            $exception->getMessage(),
            ['exception' => get_class($exception)]
        );
    }
}
