<?php

namespace App\Services\Backup\Transformers;

use App\Models\ReportExport;
use Illuminate\Database\Eloquent\Model;

class ReportExportTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return ReportExport::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'report_type' => $model->report_type,
            'format' => $model->format,
            'period_from' => $this->formatDate($model->period_from),
            'period_to' => $this->formatDate($model->period_to),
            'basis' => $model->basis,
            'params' => $model->params,
            'status' => $model->status,
            'file_size' => $model->file_size,
            'expires_at' => $this->formatDate($model->expires_at),
            'created_by_public_id' => $this->getRelatedPublicId($model->creator),
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
