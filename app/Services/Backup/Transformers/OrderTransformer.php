<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class OrderTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\Order::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'contact_public_id' => $this->getRelatedPublicId($model->contact),
            'quote_public_id' => $this->getRelatedPublicId($model->quote),
            'order_number' => $model->order_number,
            'order_date' => $this->formatDate($model->order_date),
            'delivery_date' => $this->formatDate($model->delivery_date),
            'status' => $model->status,
            'subtotal' => $this->formatDecimal($model->subtotal),
            'tax_total' => $this->formatDecimal($model->tax_total),
            'total' => $this->formatDecimal($model->total),
            'intro_text' => $model->intro_text,
            'payment_terms' => $model->payment_terms,
            'footer_note' => $model->footer_note,
            'notes' => $model->notes,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
            'deleted_at' => $this->formatDate($model->deleted_at),
        ];
    }
}
