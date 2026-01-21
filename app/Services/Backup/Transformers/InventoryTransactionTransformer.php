<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class InventoryTransactionTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\InventoryTransaction::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'product_public_id' => $this->getRelatedPublicId($model->product),
            'quantity' => $this->formatDecimal($model->quantity),
            'type' => $model->type,
            'reference_type' => $model->reference_type,
            'reference_id' => $model->reference_id,
            'description' => $model->description,
            'balance_after' => $this->formatDecimal($model->balance_after),
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
