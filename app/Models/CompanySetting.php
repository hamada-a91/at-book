<?php

namespace App\Models;

use App\Http\Middleware\OnboardingMiddleware;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class CompanySetting extends Model
{
    use BelongsToTenant, HasPublicId;

    /**
     * SPEC-07 (7.3): robuste Cache-Invalidierung - unabhängig davon, WO
     * onboarding_completed (oder andere Felder) geändert werden (Controller,
     * Command, Tinker, ...), wird der Onboarding-Cache des betroffenen
     * Tenants bei jedem save() verworfen. Ergänzt die expliziten
     * Cache::forget()-Aufrufe in OnboardingController::complete() und
     * onboarding:reset (die bleiben als Dokumentation der Absicht bestehen),
     * ist aber das eigentliche Sicherheitsnetz.
     */
    protected static function booted(): void
    {
        static::saved(function (CompanySetting $settings) {
            if ($settings->tenant_id !== null) {
                Cache::forget(OnboardingMiddleware::cacheKey($settings->tenant_id));
            }
        });
    }

    protected $fillable = [
        'company_name',
        'street',
        'zip',
        'city',
        'country',
        'tax_type',
        'logo_path',
        'tax_number',
        'email',
        'phone',
        'bank_details',
        'invoice_prefix',
        'invoice_footer_text',
        // SKR03 Account Plan Settings
        'business_models',
        'legal_form',
        'account_plan_initialized_at',
        'account_plan_last_updated_at',
        'onboarding_completed',
        // SPEC-05 (Teil B)
        'books_locked_until',
        // SPEC-08 (Teil A)
        'module_projects_enabled',
        'module_cost_centers_enabled',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'bank_details' => 'array',
            'account_plan_initialized_at' => 'datetime',
            'account_plan_last_updated_at' => 'datetime',
            'onboarding_completed' => 'boolean',
            'books_locked_until' => 'date',
            'module_projects_enabled' => 'boolean',
            'module_cost_centers_enabled' => 'boolean',
        ];
    }
}
