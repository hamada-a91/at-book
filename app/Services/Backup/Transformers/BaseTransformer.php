<?php

namespace App\Services\Backup\Transformers;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Base class for entity transformers.
 */
abstract class BaseTransformer
{
    /**
     * Get the model class for this transformer.
     */
    abstract public function getModelClass(): string;

    /**
     * Transform a model to an exportable array.
     */
    abstract public function transform(Model $model): array;

    /**
     * Get the query for fetching entities to export.
     */
    public function getQuery(Tenant $tenant): Builder
    {
        $modelClass = $this->getModelClass();
        
        // Start with withTrashed if available to include soft-deleted records
        if (method_exists($modelClass, 'withTrashed')) {
            $query = $modelClass::withTrashed();
        } else {
            $query = $modelClass::query();
        }

        // Remove global scopes (like TenantScope) and add manual tenant filter
        $query = $query->withoutGlobalScopes();

        // Check if the model's table has tenant_id column
        $instance = new $modelClass;
        $table = $instance->getTable();
        
        // Use schema to check if tenant_id exists
        if (\Schema::hasColumn($table, 'tenant_id')) {
            $query->where('tenant_id', $tenant->id);
        }

        return $query->orderBy('id');
    }

    /**
     * Get the public_id of a related model or null.
     */
    protected function getRelatedPublicId(?Model $model): ?string
    {
        return $model?->public_id;
    }

    /**
     * Format a date for export.
     */
    protected function formatDate($date): ?string
    {
        if (!$date) {
            return null;
        }

        if ($date instanceof \Carbon\Carbon || $date instanceof \DateTimeInterface) {
            return $date->toIso8601String();
        }

        return (string) $date;
    }

    /**
     * Format a decimal value.
     */
    protected function formatDecimal($value, int $decimals = 2): ?string
    {
        if ($value === null) {
            return null;
        }

        return number_format((float) $value, $decimals, '.', '');
    }
}
