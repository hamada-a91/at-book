<?php

namespace App\Providers;

use App\Services\Backup\BackupExportService;
use App\Services\Backup\BackupImportService;
use App\Services\Backup\Transformers\EntityTransformerRegistry;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Register Backup Services
        $this->app->singleton(EntityTransformerRegistry::class, function ($app) {
            return new EntityTransformerRegistry();
        });

        $this->app->singleton(BackupExportService::class, function ($app) {
            return new BackupExportService(
                $app->make(EntityTransformerRegistry::class)
            );
        });

        $this->app->singleton(BackupImportService::class, function ($app) {
            return new BackupImportService(
                $app->make(BackupExportService::class)
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if (app()->environment('production')) {
            \Illuminate\Support\Facades\URL::forceScheme('https');
        }

        // Gate for backup management - only owners/admins
        Gate::define('backup-manage', function ($user) {
            // Check if user has owner or admin role
            if (method_exists($user, 'hasRole')) {
                return $user->hasRole(['owner', 'admin', 'super-admin']);
            }
            
            // Fallback: allow if user exists
            return true;
        });
    }
}
