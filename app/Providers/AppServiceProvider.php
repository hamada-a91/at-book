<?php

namespace App\Providers;

use App\Models\BankAccount;
use App\Models\Beleg;
use App\Models\Invoice;
use App\Models\TaxCode;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Observers\AuditObserver;
use App\Modules\Contacts\Models\Contact;
use App\Modules\Projects\Models\Project;
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
            return new EntityTransformerRegistry;
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

        // SPEC-06: Audit-Log - Standard-CRUD-Protokollierung (created/
        // updated/deleted) für alle buchhaltungsrelevanten Modelle + User
        // (created/blocked/unblocked/role-changed, siehe AuditObserver).
        // Feuert nur bei Schreiboperationen, kein Einfluss auf Listen-/
        // Lese-Performance.
        foreach ([
            JournalEntry::class,
            Invoice::class,
            Beleg::class,
            Account::class,
            TaxCode::class,
            BankAccount::class,
            Contact::class,
            User::class,
            // SPEC-08 (Teil A)
            Project::class,
        ] as $auditedModel) {
            $auditedModel::observe(AuditObserver::class);
        }
    }
}
