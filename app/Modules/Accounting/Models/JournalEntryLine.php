<?php

namespace App\Modules\Accounting\Models;

use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JournalEntryLine extends Model
{
    protected $guarded = ['id'];

    /**
     * SPEC-04 (4.5): GoBD-Enforcement über den Parent (JournalEntry). Eine
     * Buchungszeile gilt als festgeschrieben, sobald die zugehörige
     * JournalEntry gelockt ist - Updates/Deletes sind dann gesperrt. Das
     * Anlegen neuer Zeilen bleibt erlaubt (wird u.a. von
     * BookingService::reverseBooking() für die Storno-Gegenbuchung benötigt,
     * deren Kopf-Datensatz bereits vor dem Anlegen der Zeilen gelockt ist).
     *
     * Backup-Import läuft über Model::withoutEvents(...) und ist davon nicht
     * betroffen (siehe JournalEntry::booted()).
     */
    protected static function booted(): void
    {
        static::updating(function (JournalEntryLine $line) {
            if (! $line->isLockedViaParent()) {
                return;
            }

            // GoBD: Der finanzielle Teil einer festgeschriebenen Zeile (Konto,
            // Soll/Haben, Betrag, Steuer) bleibt unveränderlich. Kostenstelle/
            // Kostenträger sind hingegen eine reine AUSWERTUNGS-Dimension (kein
            // Teil der Buchung selbst) und dürfen auch nachträglich zugeordnet/
            // korrigiert werden - jede solche Änderung wird per Audit-Log
            // protokolliert (siehe JournalEntryController::updateDimensions()).
            $dirty = array_keys($line->getDirty());
            $onlyDimensions = $dirty !== [] && empty(array_diff($dirty, ['cost_center_id', 'cost_object_id']));

            if (! $onlyDimensions) {
                throw new DomainException('Festgeschriebene Buchungszeile (GoBD) kann nicht geändert werden.');
            }
        });

        static::deleting(function (JournalEntryLine $line) {
            if ($line->isLockedViaParent()) {
                throw new DomainException('Festgeschriebene Buchungszeile (GoBD) kann nicht gelöscht werden.');
            }
        });
    }

    private function isLockedViaParent(): bool
    {
        $entry = $this->relationLoaded('journalEntry')
            ? $this->getRelation('journalEntry')
            : JournalEntry::withoutGlobalScopes()->find($this->journal_entry_id);

        return $entry !== null && $entry->locked_at !== null;
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }

    public function account(): BelongsTo
    {
        // Assuming Account model is in the same namespace for simplicity
        return $this->belongsTo(Account::class);
    }

    /**
     * SPEC-08 (Teil A): Kostenstelle (KOST1) - optional, siehe
     * docs/specs/SPEC-08-projekte-kostenstellen.md.
     */
    public function costCenter(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Projects\Models\CostCenter::class);
    }

    /**
     * SPEC-08 (Teil A): Kostenträger (KOST2) - optional, i.d.R. aus
     * project_id des Dokuments abgeleitet (Durchreich-Logik in
     * InvoiceBookingService/BelegController::book()/BookingService::createBooking()).
     */
    public function costObject(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Projects\Models\CostObject::class);
    }
}
