<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class ProductTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\Product::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'type' => $model->type,
            'name' => $model->name,
            'description' => $model->description,
            'article_number' => $model->article_number,
            'gtin_ean' => $model->gtin_ean,
            'unit' => $model->unit,
            'price_net' => $model->price_net,
            'price_gross' => $model->price_gross,
            'tax_rate' => $this->formatDecimal($model->tax_rate),
            'track_stock' => $model->track_stock,
            'stock_quantity' => $this->formatDecimal($model->stock_quantity),
            'reorder_level' => $this->formatDecimal($model->reorder_level),
            'account_public_id' => $this->getRelatedPublicId($model->account),
            'expense_account_public_id' => $this->getRelatedPublicId($model->expenseAccount),
            'category_public_id' => $this->getRelatedPublicId($model->category),
            'notes' => $model->notes,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
            'deleted_at' => $this->formatDate($model->deleted_at),
        ];
    }
}
