<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class ReportAccountMappingTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Modules\Accounting\Models\ReportAccountMapping::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'report_type' => $model->report_type,
            'form_version' => $model->form_version,
            'source_type' => $model->source_type,
            'source_public_id' => $model->source_public_id,
            'target_code' => $model->target_code,
            'value_type' => $model->value_type,
            'sign' => $model->sign,
            'valid_from' => $this->formatDate($model->valid_from),
            'valid_until' => $this->formatDate($model->valid_until),
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
