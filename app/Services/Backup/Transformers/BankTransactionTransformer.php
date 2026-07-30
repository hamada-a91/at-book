<?php

namespace App\Services\Backup\Transformers;

use App\Models\BankTransaction;
use Illuminate\Database\Eloquent\Model;

class BankTransactionTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return BankTransaction::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'bank_account_public_id' => $this->getRelatedPublicId($model->bankAccount),
            'import_batch_public_id' => $this->getRelatedPublicId($model->importBatch),
            'booking_date' => $this->formatDate($model->booking_date),
            'value_date' => $this->formatDate($model->value_date),
            'counterparty' => $model->counterparty,
            'purpose' => $model->purpose,
            'amount' => $this->formatDecimal($model->amount),
            'currency' => $model->currency,
            'fingerprint' => $model->fingerprint,
            'status' => $model->status,
            'matched_type' => $model->matched_type,
            'matched_public_id' => $this->matchedPublicId($model),
            'journal_entry_public_id' => $this->getRelatedPublicId($model->journalEntry),
            'raw' => $model->raw,
            'notes' => $model->notes,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }

    private function matchedPublicId(BankTransaction $model): ?string
    {
        if (! $model->matched_type || ! $model->matched_id) {
            return null;
        }

        $class = match ($model->matched_type) {
            'invoice' => \App\Models\Invoice::class,
            'beleg' => \App\Models\Beleg::class,
            'journal_entry' => \App\Modules\Accounting\Models\JournalEntry::class,
            'category' => \App\Modules\Accounting\Models\Account::class,
            default => null,
        };

        return $class ? $class::withoutGlobalScopes()->whereKey($model->matched_id)->value('public_id') : null;
    }
}
