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
