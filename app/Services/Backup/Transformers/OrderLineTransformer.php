<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class OrderLineTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\OrderLine::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'order_public_id' => $this->getRelatedPublicId($model->order),
            'product_public_id' => $this->getRelatedPublicId($model->product),
            'description' => $model->description,
            'quantity' => $this->formatDecimal($model->quantity),
            'delivered_quantity' => $this->formatDecimal($model->delivered_quantity),
            'invoiced_quantity' => $this->formatDecimal($model->invoiced_quantity),
            'unit' => $model->unit,
            'unit_price' => $this->formatDecimal($model->unit_price),
            'tax_rate' => $this->formatDecimal($model->tax_rate),
            'line_total' => $this->formatDecimal($model->line_total),
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
