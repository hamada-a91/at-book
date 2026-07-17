<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;

/**
 * SPEC-05 (Teil A): Ein Nummernkreis pro Tenant/Typ/Jahr ('journal' nutzt
 * year=0, jahresunabhängig). Wird ausschließlich über
 * App\Services\NumberSequenceService::next() fortgeschrieben (lockForUpdate,
 * siehe dort) - kein direktes ->increment() anderswo im Code.
 *
 * Bewusst NICHT im Backup exportiert (siehe Migration/Registry-Kommentar):
 * last_number wird beim Import aus den importierten Dokument-/Journalnummern
 * rekonstruiert statt exportiert (robuster gegen alte/manipulierte Backups).
 */
class NumberSequence extends Model
{
    use BelongsToTenant, HasPublicId;

    protected $guarded = ['id'];

    protected $casts = [
        'year' => 'integer',
        'last_number' => 'integer',
    ];
}
