<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class OnboardingMiddleware
{
    /**
     * Handle an incoming request.
     * 
     * Blockiert Zugriff auf geschützte Bereiche, wenn Onboarding nicht abgeschlossen ist
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $settings = \App\Models\CompanySetting::first();
        
        // Wenn keine Settings existieren, erlaube Zugriff (Fresh Installation)
        if (!$settings) {
            return $next($request);
        }
        
        // Wenn Onboarding nicht abgeschlossen ist, blocke
        if (!$settings->onboarding_completed) {
            return response()->json([
                'message' => 'Bitte schließen Sie zunächst das Onboarding ab',
                'redirect' => '/onboarding'
            ], 403);
        }
        
        return $next($request);
    }
}
