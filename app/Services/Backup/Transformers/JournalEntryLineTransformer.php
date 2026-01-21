<?php

namespace App\Services\Backup\Transformers;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class JournalEntryLineTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Modules\Accounting\Models\JournalEntryLine::class;
    }

    public function getQuery(Tenant $tenant): Builder
    {
        // JournalEntryLine doesn't have tenant_id directly, get through JournalEntry
        return $this->getModelClass()::query()
            ->whereHas('journalEntry', function ($q) use ($tenant) {
                $q->where('tenant_id', $tenant->id);
            })
            ->orderBy('id');
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id ?? null,
            'journal_entry_public_id' => $this->getRelatedPublicId($model->journalEntry),
            'account_public_id' => $this->getRelatedPublicId($model->account),
            'debit' => $this->formatDecimal($model->debit),
            'credit' => $this->formatDecimal($model->credit),
            'description' => $model->description,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
