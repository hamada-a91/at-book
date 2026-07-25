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
     */
    protected function getTenant(): ?Tenant
    {
        // Use 'api' guard for JWT authentication
        if (! auth('api')->check()) {
            Log::warning('HasTenantScope: User not authenticated (JWT)');

            return null;
        }

        $user = auth('api')->user();

        // Ensure tenant relationship is loaded
        if (! $user->relationLoaded('tenant')) {
            $user->load('tenant');
        }

        if (! $user->tenant) {
            Log::warning('HasTenantScope: User has no tenant', [
                'user_id' => $user->id,
                'user_email' => $user->email,
            ]);
        }

        return $user->tenant;
    }

    /**
     * Get tenant or fail with detailed error
     * Uses 'api' guard for JWT authentication
     */
    protected function getTenantOrFail(): Tenant
    {
        // Use 'api' guard for JWT authentication
        if (! auth('api')->check()) {
            Log::error('HasTenantScope: getTenantOrFail called but user not authenticated (JWT)');
            abort(401, 'Unauthenticated. Please login.');
        }

        $tenant = $this->getTenant();

        if (! $tenant) {
            $user = auth('api')->user();
            Log::error('HasTenantScope: User has no tenant association', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'user_tenant_id' => $user->tenant_id ?? 'NULL',
            ]);
            abort(403, 'No tenant associated with this user. Please contact support.');
        }

        return $tenant;
    }

    /**
     * Scope query to current tenant
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    protected function scopeToTenant($query)
    {
        $tenant = $this->getTenantOrFail();

        return $query->where('tenant_id', $tenant->id);
    }

    /**
     * SPEC-08 (Teil A): Sicherheits-Fix für implizites Route-Model-Binding.
     *
     * routes/api.php registriert die Fach-Routen als
     * `Route::middleware(['api', 'auth:api', SetTenantFromUser::class])`.
     * Die 'api'-Middleware-Gruppe enthält (siehe bootstrap/app.php)
     * `Illuminate\Routing\Middleware\SubstituteBindings::class` - und die
     * steht in der Ausführungsreihenfolge VOR 'auth:api'/SetTenantFromUser.
     * Ein implizit gebundener Controller-Parameter (z.B. `CostCenter
     * $costCenter`) wird also aufgelöst, BEVOR der Tenant-Kontext gesetzt
     * ist - der BelongsToTenant-Global-Scope greift zu diesem Zeitpunkt
     * noch NICHT (tenant() ist null), das gebundene Model kann daher
     * initial der Datensatz JEDES Tenants sein (Cross-Tenant-Leck).
     *
     * Controller, die implizite Bindung für ein tenant-scoped Model nutzen,
     * MÜSSEN diese Methode als ERSTE Zeile in show/update/destroy (u.ä.)
     * aufrufen, um die fehlende Tenant-Prüfung nachzuholen. 404 (nicht 403)
     * - die Existenz einer fremden ID soll nicht verraten werden (siehe
     * TenantIsolationTest-Docblock, gleiche Begründung wie bei den
     * bestehenden Controllern, die stattdessen explizit
     * `Model::where('tenant_id', ...)->findOrFail()` nutzen).
     */
    protected function assertOwnedByTenant(mixed $model): void
    {
        $tenant = $this->getTenantOrFail();

        if (! $model || (int) ($model->tenant_id ?? 0) !== (int) $tenant->id) {
            abort(404);
        }
    }
}
