<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Tenant;
use Illuminate\Support\Facades\Log;

/**
 * Trait HasTenantScope
 * 
 * Provides helper methods for controllers to get and validate tenant context
 */
trait HasTenantScope
{
    /**
     * Get the current authenticated user's tenant
     * Uses 'api' guard for JWT authentication
     * 
     * @return Tenant|null
     */
    protected function getTenant(): ?Tenant
    {
        // Use 'api' guard for JWT authentication
        if (!auth('api')->check()) {
            Log::warning('HasTenantScope: User not authenticated (JWT)');
            return null;
        }

        $user = auth('api')->user();
        
        // Ensure tenant relationship is loaded
        if (!$user->relationLoaded('tenant')) {
            $user->load('tenant');
        }

        if (!$user->tenant) {
            Log::warning('HasTenantScope: User has no tenant', [
                'user_id' => $user->id,
                'user_email' => $user->email
            ]);
        }

        return $user->tenant;
    }

    /**
     * Get tenant or fail with detailed error
     * Uses 'api' guard for JWT authentication
     * 
     * @return Tenant
     */
    protected function getTenantOrFail(): Tenant
    {
        // Use 'api' guard for JWT authentication
        if (!auth('api')->check()) {
            Log::error('HasTenantScope: getTenantOrFail called but user not authenticated (JWT)');
            abort(401, 'Unauthenticated. Please login.');
        }

        $tenant = $this->getTenant();

        if (!$tenant) {
            $user = auth('api')->user();
            Log::error('HasTenantScope: User has no tenant association', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'user_tenant_id' => $user->tenant_id ?? 'NULL'
            ]);
            abort(403, 'No tenant associated with this user. Please contact support.');
        }

        return $tenant;
    }

    /**
     * Scope query to current tenant
     * 
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    protected function scopeToTenant($query)
    {
        $tenant = $this->getTenantOrFail();
        
        return $query->where('tenant_id', $tenant->id);
    }
}
