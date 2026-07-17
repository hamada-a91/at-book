<?php

namespace App\Modules\Accounting\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class JournalEntry extends Model
{
    use BelongsToTenant, HasPublicId, SoftDeletes;

    protected $guarded = ['id'];

    protected $casts = [
        'booking_date' => 'date',
        'locked_at' => 'datetime',
    ];

    /**
     * SPEC-04 (4.5): GoBD-Enforcement.
     *
     * Bisher (DURCHSETZUNGSLÜCKE, siehe GobdTest vor SPEC-04) ließ sich eine
     * festgeschriebene (locked_at gesetzt) Buchung weiterhin per direktem
     * Model-Update ändern oder löschen - es gab weder Observer noch DB-
     * Constraint. Ab hier gilt: sobald locked_at gesetzt ist, sind Updates und
     * Deletes grundsätzlich gesperrt.
     *
     * EINZIGE erlaubte Ausnahme: BookingService::reverseBooking() markiert die
     * originale (bereits gelockte) Buchung als 'cancelled' - das ist der
     * GoBD-konforme Weg, eine festgeschriebene Buchung "aufzuheben" (Storno per
     * Generalumkehr, nicht per Änderung/Löschung der Ursprungsbuchung). Diese
     * eine Attributänderung wird durchgelassen, indem geprüft wird, dass
     * AUSSCHLIESSLICH 'status' dirty ist und der neue Wert 'cancelled' lautet.
     * Jede andere Änderung an einer gelockten Buchung (auch eine gleichzeitige
     * Änderung von 'status' UND einem anderen Feld) wirft eine Exception.
     *
     * Backup-Import ist davon nicht betroffen: BackupImportService importiert
     * Model-Änderungen explizit über Model::withoutEvents(...), wodurch diese
     * Hooks dort nicht feuern (siehe app/Services/Backup/BackupImportService.php).
     */
    protected static function booted(): void
    {
        static::updating(function (JournalEntry $entry) {
            if ($entry->getOriginal('locked_at') === null) {
                return;
            }

            $dirty = $entry->getDirty();
            $isReversalStatusFlip = count($dirty) === 1
                && array_key_exists('status', $dirty)
                && $dirty['status'] === 'cancelled';

            if (! $isReversalStatusFlip) {
                throw new DomainException('Festgeschriebene Buchung (GoBD) kann nicht geändert werden. Nur ein Storno (Generalumkehr) ist möglich.');
            }
        });

        static::deleting(function (JournalEntry $entry) {
            if ($entry->locked_at !== null) {
                throw new DomainException('Festgeschriebene Buchung (GoBD) kann nicht gelöscht werden. Nur ein Storno (Generalumkehr) ist möglich.');
            }
        });
    }

    public function lines(): HasMany
    {
        return $this->hasMany(JournalEntryLine::class);
    }

    public function user()
    {
        return $this->belongsTo(\App\Models\User::class);
    }

    public function contact()
    {
        return $this->belongsTo(\App\Modules\Contacts\Models\Contact::class);
    }

    public function belege()
    {
        return $this->hasMany(\App\Models\Beleg::class);
    }

    public function beleg()
    {
        return $this->belongsTo(\App\Models\Beleg::class);
    }
}
