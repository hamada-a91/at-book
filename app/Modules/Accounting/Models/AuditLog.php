<?php

namespace App\Modules\Accounting\Models; // Or a shared module like App\Modules\Core\Models

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    public $timestamps = false; // Only created_at

    protected $guarded = ['id'];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        // Assuming User model is in App\Models
        return $this->belongsTo(\App\Models\User::class);
    }
}
