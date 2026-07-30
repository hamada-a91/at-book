<?php

namespace App\Services\Backup\Transformers;

use App\Models\Payment;
use Illuminate\Database\Eloquent\Model;

class PaymentTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return Payment::class;
    }

    public function transform(Model $model): array
    {
        $payable = $model->payable_type === 'invoice' ? $model->invoice : $model->beleg;

        return [
            'public_id' => $model->public_id,
            'payable_type' => $model->payable_type,
            'payable_public_id' => $this->getRelatedPublicId($payable),
            'amount' => $this->formatDecimal($model->amount),
            'payment_date' => $this->formatDate($model->payment_date),
            'payment_account_public_id' => $this->getRelatedPublicId($model->paymentAccount),
            'journal_entry_public_id' => $this->getRelatedPublicId($model->journalEntry),
            'bank_transaction_public_id' => $this->getRelatedPublicId($model->bankTransaction),
            'discount_amount' => $this->formatDecimal($model->discount_amount),
            'discount_account_public_id' => $this->getRelatedPublicId($model->discountAccount),
            'reversal_journal_entry_public_id' => $this->getRelatedPublicId($model->reversalJournalEntry),
            'reversed_at' => $this->formatDate($model->reversed_at),
            'note' => $model->note,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
