<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * SetTenantFromPath Middleware
 * 
 * Resolves the tenant from the URL path (e.g., /acme-corp/dashboard)
 * and stores it in the service container for use throughout the request.
 * 
 * This is a path-based multi-tenancy approach suitable for localhost development.
 * Can be migrated to subdomain-based routing later for production.
 */
class SetTenantFromPath
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Extract tenant slug from the first segment of the path
        // E.g., /default/dashboard -> slug = "default"
        $tenantSlug = $request->segment(1);

        // Skip tenant resolution for auth routes and API without tenant prefix
        $pathsToSkip = ['register', 'login', 'logout', 'password', 'api'];
        if (in_array($tenantSlug, $pathsToSkip) || empty($tenantSlug)) {
            return $next($request);
        }

        // Look up the tenant by slug
        $tenant = Tenant::where('slug', $tenantSlug)->first();

        // If tenant not found, return 404
        if (!$tenant) {
            abort(404, 'Tenant not found');
        }

        // Store the tenant in the service container for this request
        // This makes it available via the tenant() helper function
        app()->instance('currentTenant', $tenant);

        return $next($request);
    }
}
