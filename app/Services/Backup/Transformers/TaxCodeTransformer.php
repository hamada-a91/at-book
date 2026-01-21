<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class TaxCodeTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\TaxCode::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'code' => $model->code,
            'name' => $model->name,
            'type' => $model->type,
            'rate' => $this->formatDecimal($model->rate),
            'account_public_id' => $this->getRelatedPublicId($model->account),
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
