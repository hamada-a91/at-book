<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BackupAuditLog extends Model
{
    use BelongsToTenant;

    public const ACTION_EXPORT_STARTED = 'export_started';
    public const ACTION_EXPORT_COMPLETED = 'export_completed';
    public const ACTION_EXPORT_FAILED = 'export_failed';
    public const ACTION_EXPORT_DOWNLOADED = 'export_downloaded';
    public const ACTION_IMPORT_UPLOADED = 'import_uploaded';
    public const ACTION_IMPORT_VALIDATED = 'import_validated';
    public const ACTION_IMPORT_STARTED = 'import_started';
    public const ACTION_IMPORT_COMPLETED = 'import_completed';
    public const ACTION_IMPORT_FAILED = 'import_failed';
    public const ACTION_PRE_RESTORE_BACKUP = 'pre_restore_backup';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'backup_job_id',
        'action',
        'ip_address',
        'user_agent',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    /**
     * Get the user who performed the action.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the backup job related to this log.
     */
    public function backupJob(): BelongsTo
    {
        return $this->belongsTo(BackupJob::class);
    }

    /**
     * Create a new audit log entry.
     */
    public static function log(
        string $action,
        ?BackupJob $job = null,
        array $metadata = [],
        ?User $user = null
    ): self {
        $tenant = tenant();
        $currentUser = $user ?? auth()->user();

        return self::create([
            'tenant_id' => $tenant?->id ?? $job?->tenant_id,
            'user_id' => $currentUser?->id,
            'backup_job_id' => $job?->id,
            'action' => $action,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'metadata' => $metadata,
        ]);
    }
}
