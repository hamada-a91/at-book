<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class AccountTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Modules\Accounting\Models\Account::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'code' => $model->code,
            'name' => $model->name,
            'type' => $model->type,
            'category' => $model->category,
            'is_system' => $model->is_system,
            'is_generated' => $model->is_generated,
            'skr03_class' => $model->skr03_class,
            'default_tax_code' => $model->default_tax_code,
            'default_tax_rate' => $this->formatDecimal($model->default_tax_rate),
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
