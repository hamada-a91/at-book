<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class QuoteTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\Quote::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'contact_public_id' => $this->getRelatedPublicId($model->contact),
            'order_public_id' => $this->getRelatedPublicId($model->order),
            'quote_number' => $model->quote_number,
            'quote_date' => $this->formatDate($model->quote_date),
            'valid_until' => $this->formatDate($model->valid_until),
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
