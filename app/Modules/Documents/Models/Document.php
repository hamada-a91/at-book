<?php

namespace App\Modules\Documents\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Document extends Model
{
    // Note: This model uses morph relationship (documentable) instead of direct tenant_id
    // Documents are linked to JournalEntry or other tenant-scoped models

    protected $guarded = ['id'];

    protected $casts = [
        'uploaded_at' => 'datetime',
    ];

    public function documentable(): MorphTo
    {
        return $this->morphTo();
    }
}

