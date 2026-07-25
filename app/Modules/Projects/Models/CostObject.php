<?php

namespace App\Modules\Projects\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * SPEC-08 (Teil A): Kostenträger (KOST2) - "wofür" (Projekt/Auftrag/
 * Produktlinie). Jedes Projekt bekommt bei Anlage automatisch genau einen
 * eigenen Kostenträger (siehe Project::booted()/ProjectController::store()).
 * Kostenträger können auch unabhängig von einem Projekt verwaltet werden.
 */
class CostObject extends Model
{
    use BelongsToTenant, HasPublicId;

    protected $fillable = [
        'code',
        'name',
        'description',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function journalEntryLines(): HasMany
    {
        return $this->hasMany(\App\Modules\Accounting\Models\JournalEntryLine::class);
    }

    public function project(): HasOne
    {
        return $this->hasOne(Project::class);
    }
}
