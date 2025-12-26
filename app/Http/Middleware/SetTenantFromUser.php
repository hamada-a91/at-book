<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetTenantFromUser
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Check if user is authenticated via API guard
        if (auth('api')->check()) {
            $user = auth('api')->user();
            
            // Ensure tenant is loaded
            if (!$user->relationLoaded('tenant')) {
                $user->load('tenant');
            }

            // Bind tenant to service container if available
            if ($user->tenant) {
                app()->instance('currentTenant', $user->tenant);
            }
        }

        return $next($request);
    }
}
