<?php

namespace App\Models\Concerns;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Trait BelongsToTenant
 * 
 * Automatically scopes all queries to the current tenant.
 * Auto-sets tenant_id when creating models.
 * 
 * Usage:
 * - Apply to any model that should be tenant-scoped
 * - DO NOT apply to User model (users need to be queryable across tenants for login)
 * 
 * Example:
 * class Account extends Model {
 *     use BelongsToTenant;
 * }
 */
trait BelongsToTenant
{
    /**
     * Boot the trait
     */
    protected static function bootBelongsToTenant(): void
    {
        // Add global scope to filter all queries by current tenant
        static::addGlobalScope('tenant', function (Builder $builder) {
            if ($tenant = tenant()) {
                $builder->where('tenant_id', $tenant->id);
            }
        });

        // Auto-set tenant_id when creating a new model
        static::creating(function (Model $model) {
            if (!$model->tenant_id && $tenant = tenant()) {
                $model->tenant_id = $tenant->id;
            }
        });
    }

    /**
     * Get the tenant that owns this model
     */
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Scope a query to a specific tenant
     * 
     * @param Builder $query
     * @param int $tenantId
     * @return Builder
     */
    public function scopeForTenant(Builder $query, int $tenantId): Builder
    {
        return $query->where('tenant_id', $tenantId);
    }

    /**
     * Execute a query without the tenant scope
     * Useful for admin operations
     * 
     * @param \Closure $callback
     * @return mixed
     */
    public static function withoutTenantScope(\Closure $callback)
    {
        return static::withoutGlobalScope('tenant')->get()->each($callback);
    }
}
