<?php

namespace App\Services\Backup\Transformers;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class TenantTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\Tenant::class;
    }

    public function getQuery(Tenant $tenant): Builder
    {
        // Only export the current tenant
        return Tenant::where('id', $tenant->id);
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'name' => $model->name,
            'slug' => $model->slug,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
