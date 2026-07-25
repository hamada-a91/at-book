<?php

namespace App\Services\Backup\Transformers;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class InvoiceLineTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\InvoiceLine::class;
    }

    public function getQuery(Tenant $tenant): Builder
    {
        // invoice_lines hat keine tenant_id – ohne Parent-Scoping würden Zeilen
        // ALLER Tenants exportiert (Cross-Tenant-Leck). Invoice hat keine SoftDeletes.
        return $this->getModelClass()::query()
            ->whereHas('invoice', fn ($q) => $q->where('tenant_id', $tenant->id))
            ->orderBy('id');
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'invoice_public_id' => $this->getRelatedPublicId($model->invoice),
            'product_public_id' => $this->getRelatedPublicId($model->product),
            'account_public_id' => $this->getRelatedPublicId($model->account),
            // SPEC-08 (Teil A): optionale Dimensionen, überschreiben beim Buchen
            // den Dokument-Default (invoices.project_id).
            'cost_center_public_id' => $this->getRelatedPublicId($model->costCenter),
            'cost_object_public_id' => $this->getRelatedPublicId($model->costObject),
            'description' => $model->description,
            'quantity' => $this->formatDecimal($model->quantity),
            'unit' => $model->unit,
            'unit_price' => $this->formatDecimal($model->unit_price),
            'tax_rate' => $this->formatDecimal($model->tax_rate),
            'line_total' => $this->formatDecimal($model->line_total),
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
