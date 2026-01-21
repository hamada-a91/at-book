<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class InvoiceTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\Invoice::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'invoice_number' => $model->invoice_number,
            'contact_public_id' => $this->getRelatedPublicId($model->contact),
            'order_public_id' => $this->getRelatedPublicId($model->order),
            'invoice_date' => $this->formatDate($model->invoice_date),
            'due_date' => $this->formatDate($model->due_date),
            'status' => $model->status,
            'subtotal' => $this->formatDecimal($model->subtotal),
            'tax_total' => $this->formatDecimal($model->tax_total),
            'total' => $this->formatDecimal($model->total),
            'journal_entry_public_id' => $this->getRelatedPublicId($model->journalEntry),
            'notes' => $model->notes,
            'intro_text' => $model->intro_text,
            'payment_terms' => $model->payment_terms,
            'footer_note' => $model->footer_note,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
