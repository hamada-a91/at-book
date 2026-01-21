<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class BelegTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\Beleg::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'document_number' => $model->document_number,
            'document_type' => $model->document_type,
            'title' => $model->title,
            'document_date' => $this->formatDate($model->document_date),
            'amount' => $this->formatDecimal($model->amount),
            'tax_amount' => $this->formatDecimal($model->tax_amount),
            'contact_public_id' => $this->getRelatedPublicId($model->contact),
            'category_account_public_id' => $this->getRelatedPublicId($model->categoryAccount),
            'journal_entry_public_id' => $this->getRelatedPublicId($model->journalEntry),
            'payment_account_public_id' => $this->getRelatedPublicId($model->paymentAccount),
            'file_path' => $model->file_path,
            'file_name' => $model->file_name,
            'notes' => $model->notes,
            'status' => $model->status,
            'due_date' => $this->formatDate($model->due_date),
            'is_paid' => $model->is_paid,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
            'deleted_at' => $this->formatDate($model->deleted_at),
        ];
    }
}
