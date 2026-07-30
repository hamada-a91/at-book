<?php

namespace App\Services\Backup\Transformers;

use App\Models\BankImportBatch;
use Illuminate\Database\Eloquent\Model;

class BankImportBatchTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return BankImportBatch::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'bank_account_public_id' => $this->getRelatedPublicId($model->bankAccount),
            'user_public_id' => $this->getRelatedPublicId($model->user),
            'filename' => $model->filename,
            'settings' => $model->settings,
            'total_rows' => $model->total_rows,
            'imported_count' => $model->imported_count,
            'skipped_count' => $model->skipped_count,
            'skipped_rows' => $model->skipped_rows,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
