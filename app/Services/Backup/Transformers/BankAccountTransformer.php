<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class BankAccountTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\BankAccount::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'name' => $model->name,
            'bank_name' => $model->bank_name,
            'iban' => $model->iban,
            'bic' => $model->bic,
            'account_number' => $model->account_number,
            'bank_code' => $model->bank_code,
            'currency' => $model->currency,
            'balance' => $model->balance,
            'type' => $model->type,
            'is_default' => $model->is_default,
            'notes' => $model->notes,
            'account_public_id' => $this->getRelatedPublicId($model->account),
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
            'deleted_at' => $this->formatDate($model->deleted_at),
        ];
    }
}
