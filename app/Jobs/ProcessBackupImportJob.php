<?php

namespace App\Jobs;

use App\Models\BackupJob;
use App\Services\Backup\BackupImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;

class ProcessBackupImportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 7200; // 2 hours

    /**
     * The backup job to process.
     */
    protected BackupJob $backupJob;

    /**
     * The import mode.
     */
    protected string $mode;

    /**
     * Create a new job instance.
     */
    public function __construct(BackupJob $backupJob, string $mode = 'replace')
    {
        $this->backupJob = $backupJob;
        $this->mode = $mode;
        $this->onQueue('backups');
    }

    /**
     * Get the middleware the job should pass through.
     */
    public function middleware(): array
    {
        // Prevent multiple imports for the same tenant at once
        return [
            (new WithoutOverlapping($this->backupJob->tenant_id))
                ->releaseAfter(60)
                ->expireAfter(7200),
        ];
    }

    /**
     * Execute the job.
     */
    public function handle(BackupImportService $importService): void
    {
        $importService->processImport($this->backupJob, $this->mode);
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
