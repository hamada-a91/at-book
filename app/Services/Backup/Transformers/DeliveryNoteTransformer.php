<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class DeliveryNoteTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\DeliveryNote::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'contact_public_id' => $this->getRelatedPublicId($model->contact),
            'order_public_id' => $this->getRelatedPublicId($model->order),
            'delivery_note_number' => $model->delivery_note_number,
            'delivery_date' => $this->formatDate($model->delivery_date),
            'status' => $model->status,
            'notes' => $model->notes,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
            'deleted_at' => $this->formatDate($model->deleted_at),
        ];
    }
}
