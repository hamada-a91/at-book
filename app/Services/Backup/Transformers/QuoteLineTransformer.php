<?php

namespace App\Services\Backup\Transformers;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class QuoteLineTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\QuoteLine::class;
    }

    public function getQuery(Tenant $tenant): Builder
    {
        // quote_lines hat keine tenant_id – ohne Parent-Scoping würden Zeilen
        // ALLER Tenants exportiert (Cross-Tenant-Leck).
        return $this->getModelClass()::query()
            ->whereHas('quote', fn ($q) => $q->withTrashed()->where('tenant_id', $tenant->id))
            ->orderBy('id');
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'quote_public_id' => $this->getRelatedPublicId($model->quote),
            'product_public_id' => $this->getRelatedPublicId($model->product),
            // SPEC-08 (Teil A): optionale Dimensionen, überschreiben beim Buchen
            // den Dokument-Default (quotes.project_id).
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
