<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class JournalEntryTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Modules\Accounting\Models\JournalEntry::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'batch_id' => $model->batch_id,
            // SPEC-05 (Teil A): journal_number wird erst bei lockBooking() vergeben,
            // ist also für Drafts null - optional für alte Backups ohne dieses Feld
            // (Import setzt dann ebenfalls null, siehe BackupImportService-Kommentar
            // 'prepareForInsert' - unbekannte/fehlende Felder sind bereits Default null).
            'journal_number' => $model->journal_number,
            'booking_date' => $this->formatDate($model->booking_date),
            'description' => $model->description,
            'reference' => $model->reference,
            'user_public_id' => $this->getRelatedPublicId($model->user),
            'contact_public_id' => $this->getRelatedPublicId($model->contact),
            'beleg_public_id' => $this->getRelatedPublicId($model->beleg),
            'locked_at' => $this->formatDate($model->locked_at),
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
            'deleted_at' => $this->formatDate($model->deleted_at),
        ];
    }
}
