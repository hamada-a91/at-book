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
        // JournalEntryLine doesn't have tenant_id directly, get through JournalEntry.
        // withTrashed: Zeilen soft-gelöschter Buchungen müssen mit exportiert
        // werden (BaseTransformer exportiert die Parents ebenfalls withTrashed).
        return $this->getModelClass()::query()
            ->whereHas('journalEntry', function ($q) use ($tenant) {
                $q->withTrashed()->where('tenant_id', $tenant->id);
            })
            ->orderBy('id');
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id ?? null,
            'journal_entry_public_id' => $this->getRelatedPublicId($model->journalEntry),
            'account_public_id' => $this->getRelatedPublicId($model->account),
            // SPEC-08 (Teil A): optionale Dimensionen - alte Backups kennen diese
            // Felder nicht, Import setzt sie dann auf null (siehe mapForeignKeys()).
            'cost_center_public_id' => $this->getRelatedPublicId($model->costCenter),
            'cost_object_public_id' => $this->getRelatedPublicId($model->costObject),
            'type' => $model->type, // enum: 'debit' or 'credit'
            'amount' => $this->formatDecimal($model->amount), // stored in cents
            'tax_key' => $model->tax_key,
            'tax_amount' => $this->formatDecimal($model->tax_amount), // stored in cents
            'description' => $model->description,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
