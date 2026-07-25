<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

/**
 * SPEC-08 (Teil A): Kostenstelle (KOST1). Hat tenant_id direkt (kein Line-
 * Transformer-Muster nötig) - BaseTransformer::getQuery() reicht.
 */
class CostCenterTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Modules\Projects\Models\CostCenter::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'code' => $model->code,
            'name' => $model->name,
            'description' => $model->description,
            'active' => $model->active,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
