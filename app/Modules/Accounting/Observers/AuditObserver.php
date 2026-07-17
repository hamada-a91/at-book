<?php

namespace App\Modules\Accounting\Observers;

use App\Models\Beleg;
use App\Models\Invoice;
use App\Models\User;
use App\Modules\Accounting\Models\AuditLog;
use App\Modules\Accounting\Models\JournalEntry;
use Illuminate\Database\Eloquent\Model;

/**
 * SPEC-06: Standard-CRUD-Protokollierung (created/updated/deleted).
 *
 * Registriert in AppServiceProvider::boot() für: JournalEntry, Invoice,
 * Beleg, Account, TaxCode, BankAccount, Contact, User.
 *
 * Fachliche Events (locked, period_locked, reversed, booked,
 * payment_recorded, file_uploaded, blocked, unblocked, role_changed,
 * imported) werden EXPLIZIT aus den jeweiligen Services/Controllern gefeuert
 * (AuditLog::record(...) in BookingService/InvoiceBookingService/
 * BelegController/AdminController/UserController/BackupImportService) -
 * dieser Observer würde für genau dieselbe DB-Operation sonst einen
 * zusätzlichen, redundanten 'updated'-Eintrag schreiben. isServiceManaged()
 * unten erkennt exakt diese Übergänge an ihrer Attribut-Signatur und
 * unterdrückt in diesem einen Fall den generischen Eintrag, damit pro
 * fachlicher Aktion GENAU EIN Audit-Eintrag entsteht (SPEC-06-Akzeptanz:
 * "lock/reverse/book -> je EIGENER Event-Eintrag").
 *
 * WICHTIG: hängt an created()/updated()/deleted() (den Post-Events), NICHT
 * an creating()/updating()/deleting(). JournalEntry wirft in seinem eigenen
 * static::updating()/deleting()-Hook eine DomainException, sobald eine
 * gelockte Buchung geändert/gelöscht werden soll (siehe
 * JournalEntry::booted()). Cursor-Reihenfolge der Event-Listener zwischen
 * Model-eigenen Hooks und hier registrierten Observern ist nicht garantiert
 * - an updated()/deleted() zu hängen schließt das aus: diese Events feuern
 * ausschließlich, wenn der komplette Save-/Delete-Vorgang (inkl. aller
 * updating/deleting-Listener) bereits erfolgreich durchgelaufen ist, es kann
 * also nie ein Audit-Eintrag für eine am Ende doch abgelehnte Änderung
 * entstehen.
 */
class AuditObserver
{
    public function created(Model $model): void
    {
        AuditLog::record($model, 'created', [], $this->attributesOf($model));
    }

    public function updated(Model $model): void
    {
        $changes = $model->getChanges();
        unset($changes['updated_at']);

        if (empty($changes)) {
            return;
        }

        if ($this->isServiceManaged($model, $changes)) {
            return;
        }

        // WICHTIG: getOriginal() liefert an dieser Stelle (innerhalb des
        // 'updated'-Events) noch die Werte VOR dem Speichern - Eloquent
        // synchronisiert $original erst danach in finishSave()/syncOriginal().
        $old = [];
        foreach (array_keys($changes) as $key) {
            $old[$key] = $model->getOriginal($key);
        }

        AuditLog::record($model, 'updated', $old, $changes);
    }

    public function deleted(Model $model): void
    {
        AuditLog::record($model, 'deleted', $this->attributesOf($model), []);
    }

    private function attributesOf(Model $model): array
    {
        return $model->getAttributes();
    }

    /**
     * Erkennt Attribut-Übergänge, die bereits durch einen expliziten
     * Fach-Event aus einem Service/Controller abgedeckt werden (siehe
     * Klassenkommentar oben).
     */
    private function isServiceManaged(Model $model, array $changes): bool
    {
        if ($model instanceof JournalEntry) {
            // BookingService::lockBooking() - eigener 'locked'-Eintrag.
            if (array_key_exists('locked_at', $changes)
                && $model->getOriginal('locked_at') === null
                && $model->locked_at !== null) {
                return true;
            }

            // BookingService::reverseBooking() - Storno-Statusflip auf dem
            // Original, ausschließlich 'status' dirty (siehe
            // JournalEntry::booted(), das exakt diese eine Änderung
            // zulässt) - eigener 'reversed'-Eintrag.
            if (array_keys($changes) === ['status'] && ($changes['status'] ?? null) === 'cancelled') {
                return true;
            }
        }

        if ($model instanceof Invoice) {
            // InvoiceBookingService::bookInvoice() - eigener 'booked'-Eintrag.
            if (($changes['status'] ?? null) === 'booked' && $model->getOriginal('status') === 'draft') {
                return true;
            }

            // InvoiceBookingService::recordPayment() - eigener
            // 'payment_recorded'-Eintrag.
            if (($changes['status'] ?? null) === 'paid'
                && in_array($model->getOriginal('status'), ['booked', 'sent'], true)) {
                return true;
            }
        }

        if ($model instanceof Beleg) {
            // BelegController::book() - eigener 'booked'-Eintrag.
            if (in_array($changes['status'] ?? null, ['booked', 'paid'], true)
                && $model->getOriginal('status') === 'draft') {
                return true;
            }

            // BelegController::uploadFile() - eigener 'file_uploaded'-Eintrag.
            if (empty(array_diff(array_keys($changes), ['file_path', 'file_name']))) {
                return true;
            }
        }

        if ($model instanceof User) {
            // AdminController::blockUser()/unblockUser() - eigener
            // 'blocked'/'unblocked'-Eintrag.
            if (array_keys($changes) === ['blocked_at']) {
                return true;
            }
        }

        return false;
    }
}
