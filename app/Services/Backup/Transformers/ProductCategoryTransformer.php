<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class ProductCategoryTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\ProductCategory::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'name' => $model->name,
            'description' => $model->description,
            'color' => $model->color,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
            'deleted_at' => $this->formatDate($model->deleted_at),
        ];
    }
}
