<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class DeliveryNoteLineTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\DeliveryNoteLine::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'delivery_note_public_id' => $this->getRelatedPublicId($model->deliveryNote),
            'order_line_public_id' => $this->getRelatedPublicId($model->orderLine),
            'description' => $model->description,
            'quantity' => $this->formatDecimal($model->quantity),
            'unit' => $model->unit,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
