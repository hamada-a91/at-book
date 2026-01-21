<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessBackupExportJob;
use App\Jobs\ProcessBackupImportJob;
use App\Models\BackupAuditLog;
use App\Models\BackupJob;
use App\Models\Tenant;
use App\Services\Backup\BackupExportService;
use App\Services\Backup\BackupImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BackupController extends Controller
{
    protected BackupExportService $exportService;
    protected BackupImportService $importService;

    public function __construct(BackupExportService $exportService, BackupImportService $importService)
    {
        $this->exportService = $exportService;
        $this->importService = $importService;
    }

    /**
     * Get the current tenant (from helper or user).
     */
    protected function getTenant(): Tenant
    {
        $tenant = tenant();
        
        if (!$tenant) {
            $user = auth()->user();
            $tenant = $user->tenant;
        }
        
        if (!$tenant) {
            abort(403, 'Kein Tenant gefunden');
        }
        
        return $tenant;
    }

    /**
     * Start a new backup export.
     */
    public function startExport(Request $request): JsonResponse
    {
        $this->authorize('backup-manage');

        $validated = $request->validate([
            'include_files' => 'boolean',
        ]);

        $tenant = $this->getTenant();
        $user = auth()->user();

        // Check for existing running exports
        $runningExport = BackupJob::where('tenant_id', $tenant->id)
            ->where('type', BackupJob::TYPE_EXPORT)
            ->whereIn('status', [BackupJob::STATUS_PENDING, BackupJob::STATUS_PROCESSING])
            ->first();

        if ($runningExport) {
            return response()->json([
                'message' => 'Ein Export läuft bereits',
                'job' => $this->formatJob($runningExport),
            ], 409);
        }

        $job = $this->exportService->createExport($tenant, $user, $validated);

        ProcessBackupExportJob::dispatch($job);

        return response()->json([
            'message' => 'Export wird erstellt',
            'job' => $this->formatJob($job),
        ], 202);
    }

    /**
     * List all backup jobs for the tenant.
     */
    public function listJobs(Request $request): JsonResponse
    {
        $this->authorize('backup-manage');

        $tenant = $this->getTenant();

        $jobs = BackupJob::where('tenant_id', $tenant->id)
            // Exclude pre-restore backups (automatically created during imports)
            ->where(function($query) {
                $query->whereNull('options->is_pre_restore')
                      ->orWhere('options->is_pre_restore', false);
            })
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get()
            ->map(fn($job) => $this->formatJob($job));

        return response()->json([
            'jobs' => $jobs,
        ]);
    }


    /**
     * Get a specific backup job's status.
     */
    public function getJob(string $id): JsonResponse
    {
        $this->authorize('backup-manage');

        $tenant = $this->getTenant();

        $job = BackupJob::where('public_id', $id)
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        return response()->json([
            'job' => $this->formatJob($job),
        ]);
    }

    /**
     * Get a signed download URL for a backup.
     * This endpoint requires authentication and returns a temporary signed URL.
     */
    public function getDownloadUrl(string $id): JsonResponse
    {
        $this->authorize('backup-manage');

        $tenant = $this->getTenant();

        $job = BackupJob::where('public_id', $id)
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        if ($job->status !== BackupJob::STATUS_COMPLETED) {
            return response()->json([
                'message' => 'Backup ist noch nicht fertig oder fehlgeschlagen',
                'status' => $job->status,
            ], 400);
        }

        if (!$job->file_path || !Storage::disk('public')->exists($job->file_path)) {
            return response()->json([
                'message' => 'Backup-Datei nicht gefunden',
            ], 404);
        }

        // Create a signed download token (valid for 5 minutes)
        $token = hash_hmac('sha256', $job->public_id . now()->timestamp, config('app.key'));
        $expires = now()->addMinutes(5)->timestamp;
        
        // Store token temporarily in cache
        cache()->put("backup_download_{$token}", [
            'job_id' => $job->id,
            'tenant_id' => $tenant->id,
            'expires' => $expires,
        ], now()->addMinutes(5));

        return response()->json([
            'download_url' => url("/api/backup/download/{$job->public_id}?token={$token}&expires={$expires}"),
            'expires_at' => now()->addMinutes(5)->toIso8601String(),
        ]);
    }

    /**
     * Download a backup using a signed token (no auth required).
     */
    public function downloadBackupSigned(Request $request, string $id): StreamedResponse|JsonResponse
    {
        $token = $request->query('token');
        $expires = $request->query('expires');

        if (!$token || !$expires) {
            return response()->json(['message' => 'Token fehlt'], 400);
        }

        // Check if expired
        if (now()->timestamp > (int) $expires) {
            return response()->json(['message' => 'Download-Link abgelaufen'], 403);
        }

        // Verify token from cache
        $cached = cache()->get("backup_download_{$token}");
        if (!$cached) {
            return response()->json(['message' => 'Ungültiger Token'], 403);
        }

        $job = BackupJob::where('public_id', $id)
            ->where('id', $cached['job_id'])
            ->first();

        if (!$job || !$job->file_path) {
            return response()->json(['message' => 'Backup nicht gefunden'], 404);
        }

        if (!Storage::disk('public')->exists($job->file_path)) {
            return response()->json(['message' => 'Backup-Datei nicht gefunden'], 404);
        }

        // Log the download
        BackupAuditLog::log(BackupAuditLog::ACTION_EXPORT_DOWNLOADED, $job);

        // Clear the token (one-time use)
        cache()->forget("backup_download_{$token}");

        $filename = basename($job->file_path);

        return Storage::disk('public')->download($job->file_path, $filename, [
            'Content-Type' => 'application/zip',
        ]);
    }

    /**
     * Delete a backup job and its file.
     */
    public function deleteBackup(string $id): JsonResponse
    {
        $this->authorize('backup-manage');

        $tenant = $this->getTenant();

        $job = BackupJob::where('public_id', $id)
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        // Cannot delete running jobs
        if ($job->isRunning()) {
            return response()->json([
                'message' => 'Laufende Jobs können nicht gelöscht werden',
            ], 400);
        }

        $this->exportService->deleteBackup($job);

        return response()->json([
            'message' => 'Backup gelöscht',
        ]);
    }

    /**
     * Cancel a running or stuck backup job.
     */
    public function cancelJob(string $id): JsonResponse
    {
        $this->authorize('backup-manage');

        $tenant = $this->getTenant();

        $job = BackupJob::where('public_id', $id)
            ->where('tenant_id', $tenant->id)
            ->firstOrFail();

        // Can only cancel pending or processing jobs
        if (!in_array($job->status, [BackupJob::STATUS_PENDING, BackupJob::STATUS_PROCESSING])) {
            return response()->json([
                'message' => 'Nur laufende oder wartende Jobs können abgebrochen werden',
            ], 400);
        }

        $job->markAsFailed('Manuell abgebrochen vom Benutzer', [
            'cancelled_at' => now()->toIso8601String(),
            'cancelled_by' => auth()->id(),
        ]);

        BackupAuditLog::log(BackupAuditLog::ACTION_IMPORT_FAILED, $job, [
            'reason' => 'Manuell abgebrochen',
        ]);

        return response()->json([
            'message' => 'Job wurde abgebrochen',
            'job' => $this->formatJob($job),
        ]);
    }

    /**
     * Upload a backup file for import.
     */
    public function uploadImport(Request $request): JsonResponse
    {
        $this->authorize('backup-manage');

        $request->validate([
            'file' => 'required|file|mimes:zip|max:5242880', // Max 5GB
        ]);

        $tenant = $this->getTenant();
        $user = auth()->user();

        // Check for existing running imports
        $runningImport = BackupJob::where('tenant_id', $tenant->id)
            ->where('type', BackupJob::TYPE_IMPORT)
            ->whereIn('status', [BackupJob::STATUS_PENDING, BackupJob::STATUS_PROCESSING])
            ->first();

        if ($runningImport) {
            return response()->json([
                'message' => 'Ein Import läuft bereits',
                'job' => $this->formatJob($runningImport),
            ], 409);
        }

        $job = $this->importService->uploadBackup($tenant, $user, $request->file('file'));

        return response()->json([
            'message' => 'Backup hochgeladen',
            'job' => $this->formatJob($job),
        ], 201);
    }

    /**
     * Validate an uploaded backup.
     */
    public function validateImport(string $id): JsonResponse
    {
        $this->authorize('backup-manage');

        $tenant = $this->getTenant();

        $job = BackupJob::where('public_id', $id)
            ->where('tenant_id', $tenant->id)
            ->where('type', BackupJob::TYPE_IMPORT)
            ->firstOrFail();

        $result = $this->importService->validateBackup($job);

        return response()->json([
            'valid' => $result['valid'],
            'errors' => $result['errors'] ?? [],
            'warnings' => $result['warnings'] ?? [],
            'info' => $result['info'] ?? [],
        ]);
    }

    /**
     * Start the import process.
     * Requires password re-authentication for security.
     */
    public function startImport(Request $request, string $id): JsonResponse
    {
        $this->authorize('backup-manage');

        $validated = $request->validate([
            'confirm_password' => 'required|string',
            'import_mode' => 'in:replace,merge',
        ]);

        // Re-authenticate user
        $user = auth()->user();
        if (!Hash::check($validated['confirm_password'], $user->password)) {
            return response()->json([
                'message' => 'Passwort nicht korrekt',
            ], 403);
        }

        $tenant = $this->getTenant();

        $job = BackupJob::where('public_id', $id)
            ->where('tenant_id', $tenant->id)
            ->where('type', BackupJob::TYPE_IMPORT)
            ->where('status', BackupJob::STATUS_PENDING)
            ->firstOrFail();

        // Validate the backup first
        $validation = $this->importService->validateBackup($job);
        if (!$validation['valid']) {
            return response()->json([
                'message' => 'Backup-Validierung fehlgeschlagen',
                'errors' => $validation['errors'],
            ], 400);
        }

        $mode = $validated['import_mode'] ?? 'replace';

        ProcessBackupImportJob::dispatch($job, $mode);

        return response()->json([
            'message' => 'Import gestartet. Ein Pre-Restore-Backup wird automatisch erstellt.',
            'job' => $this->formatJob($job),
        ], 202);
    }

    /**
     * Format a job for API response.
     */
    protected function formatJob(BackupJob $job): array
    {
        return [
            'id' => $job->public_id,
            'type' => $job->type,
            'status' => $job->status,
            'progress_percent' => $job->progress_percent,
            'current_step' => $job->current_step,
            'file_size' => $job->file_size,
            'stats' => $job->stats,
            'error_message' => $job->error_message,
            'started_at' => $job->started_at?->toIso8601String(),
            'completed_at' => $job->completed_at?->toIso8601String(),
            'created_at' => $job->created_at->toIso8601String(),
            'can_download' => $job->status === BackupJob::STATUS_COMPLETED && $job->file_path && $job->type === BackupJob::TYPE_EXPORT,
        ];
    }
}
