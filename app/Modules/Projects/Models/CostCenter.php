<?php

namespace App\Modules\Projects\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * SPEC-08 (Teil A): Kostenstelle (KOST1) - "wo" Kosten entstehen (Abteilung/
 * Standort). Unabhängige Dimension, optionales Zusatzfeld für
 * Fortgeschrittene (Modul-Flag company_settings.module_cost_centers_enabled).
 */
class CostCenter extends Model
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
}
