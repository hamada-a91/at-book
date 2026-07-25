<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

/**
 * SPEC-08 (Teil A): Projekt. contact_public_id ist bewusst NULLABLE (internes
 * Projekt ohne Kunde, siehe Project-Model-Docblock) - getRelatedPublicId()
 * liefert für eine null-Relation bereits null.
 */
class ProjectTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Modules\Projects\Models\Project::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'number' => $model->number,
            'name' => $model->name,
            'contact_public_id' => $this->getRelatedPublicId($model->contact),
            'cost_object_public_id' => $this->getRelatedPublicId($model->costObject),
            'budget_amount' => $this->formatDecimal($model->budget_amount),
            'starts_on' => $this->formatDate($model->starts_on),
            'ends_on' => $this->formatDate($model->ends_on),
            'status' => $model->status,
            'notes' => $model->notes,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
