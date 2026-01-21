<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BackupJob extends Model
{
    use HasFactory, BelongsToTenant, HasPublicId;

    public const TYPE_EXPORT = 'export';
    public const TYPE_IMPORT = 'import';

    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'type',
        'status',
        'progress_percent',
        'current_step',
        'file_path',
        'file_size',
        'checksum',
        'options',
        'stats',
        'error_message',
        'error_details',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'options' => 'array',
        'stats' => 'array',
        'error_details' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'progress_percent' => 'integer',
        'file_size' => 'integer',
    ];

    /**
     * Get the user who initiated this backup job.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the audit logs for this backup job.
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(BackupAuditLog::class);
    }

    /**
     * Scope to filter export jobs.
     */
    public function scopeExports($query)
    {
        return $query->where('type', self::TYPE_EXPORT);
    }

    /**
     * Scope to filter import jobs.
     */
    public function scopeImports($query)
    {
        return $query->where('type', self::TYPE_IMPORT);
    }

    /**
     * Scope to filter pending jobs.
     */
    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    /**
     * Scope to filter processing jobs.
     */
    public function scopeProcessing($query)
    {
        return $query->where('status', self::STATUS_PROCESSING);
    }

    /**
     * Scope to filter completed jobs.
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', self::STATUS_COMPLETED);
    }

    /**
     * Check if the job is still running.
     */
    public function isRunning(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_PROCESSING]);
    }

    /**
     * Check if the job is finished (completed or failed).
     */
    public function isFinished(): bool
    {
        return in_array($this->status, [self::STATUS_COMPLETED, self::STATUS_FAILED, self::STATUS_CANCELLED]);
    }

    /**
     * Mark the job as processing.
     */
    public function markAsProcessing(string $step = null): self
    {
        $this->update([
            'status' => self::STATUS_PROCESSING,
            'current_step' => $step,
            'started_at' => $this->started_at ?? now(),
        ]);

        return $this;
    }

    /**
     * Update progress.
     */
    public function updateProgress(int $percent, string $step = null): self
    {
        $data = ['progress_percent' => min(100, max(0, $percent))];
        
        if ($step !== null) {
            $data['current_step'] = $step;
        }

        $this->update($data);

        return $this;
    }

    /**
     * Mark the job as completed.
     */
    public function markAsCompleted(string $filePath = null, int $fileSize = null, string $checksum = null, array $stats = null): self
    {
        $data = [
            'status' => self::STATUS_COMPLETED,
            'progress_percent' => 100,
            'current_step' => null,
            'completed_at' => now(),
        ];

        if ($filePath !== null) {
            $data['file_path'] = $filePath;
        }
        if ($fileSize !== null) {
            $data['file_size'] = $fileSize;
        }
        if ($checksum !== null) {
            $data['checksum'] = $checksum;
        }
        if ($stats !== null) {
            $data['stats'] = $stats;
        }

        $this->update($data);

        return $this;
    }

    /**
     * Mark the job as failed.
     */
    public function markAsFailed(string $message, array $details = null): self
    {
        $this->update([
            'status' => self::STATUS_FAILED,
            'error_message' => $message,
            'error_details' => $details,
            'completed_at' => now(),
        ]);

        return $this;
    }

    /**
     * Mark the job as cancelled.
     */
    public function markAsCancelled(): self
    {
        $this->update([
            'status' => self::STATUS_CANCELLED,
            'completed_at' => now(),
        ]);

        return $this;
    }
}
