<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Register Onboarding Middleware
        $middleware->alias([
            'onboarding.complete' => \App\Http\Middleware\OnboardingMiddleware::class,
            'tenant' => \App\Http\Middleware\SetTenantFromPath::class,
            'force.json' => \App\Http\Middleware\ForceJsonResponse::class,
        ]);
        
        // Add tenant middleware to web group (runs for all web routes)
        $middleware->web(append: [
            \App\Http\Middleware\SetTenantFromPath::class,
        ]);
        
        // JWT Authentication Middleware for API routes
        // CRITICAL: This ensures JWT tokens are parsed from Authorization header
        $middleware->api(prepend: [
            \App\Http\Middleware\ForceJsonResponse::class,
            // \Tymon\JWTAuth\Http\Middleware\Authenticate::class, // REMOVED: Do not force auth globally
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
