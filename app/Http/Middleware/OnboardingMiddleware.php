<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class OnboardingMiddleware
{
    /**
     * SPEC-07 (7.3): Präfix des Cache-Keys, unter dem der Onboarding-Status
     * pro Tenant abgelegt wird. Von OnboardingController::complete() und
     * dem onboarding:reset-Command zur Invalidierung wiederverwendet, damit
     * das Key-Format nicht an mehreren Stellen auseinanderlaufen kann.
     */
    private const CACHE_PREFIX = 'onboarding_done:';

    private const CACHE_TTL_SECONDS = 3600;

    public static function cacheKey(int $tenantId): string
    {
        return self::CACHE_PREFIX.$tenantId;
    }

    /**
     * Handle an incoming request.
     *
     * Blockiert Zugriff auf geschützte Bereiche, wenn Onboarding nicht abgeschlossen ist.
     *
     * SPEC-07 (7.3, behebt 08/Punkt 14): Das Ergebnis (abgeschlossen ja/nein)
     * wird pro Tenant 1h gecacht, damit nicht jeder Fach-Request ein
     * company_settings-SELECT auslöst. Invalidierung erfolgt aktiv bei
     * OnboardingController::complete(), im onboarding:reset-Command und
     * zusätzlich robust über einen saved()-Hook auf CompanySetting selbst
     * (siehe App\Models\CompanySetting::booted()).
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = tenant()?->id;

        $allowed = $tenantId !== null
            ? Cache::remember(self::cacheKey($tenantId), self::CACHE_TTL_SECONDS, fn () => $this->isOnboardingComplete())
            : $this->isOnboardingComplete();

        if (! $allowed) {
            return response()->json([
                'message' => 'Bitte schließen Sie zunächst das Onboarding ab',
                'redirect' => '/onboarding',
            ], 403);
        }

        return $next($request);
    }

    /**
     * Ermittelt den tatsächlichen Onboarding-Status (ungecacht). Fresh
     * Installation ohne Settings gilt weiterhin als "erlaubt" (unverändertes
     * Verhalten aus der Vor-SPEC-07-Fassung).
     */
    private function isOnboardingComplete(): bool
    {
        $settings = \App\Models\CompanySetting::first();

        if (! $settings) {
            return true;
        }

        return (bool) $settings->onboarding_completed;
    }
}
