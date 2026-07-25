<?php

namespace App\Console\Commands;

use App\Http\Middleware\OnboardingMiddleware;
use App\Models\CompanySetting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class ResetOnboarding extends Command
{
    protected $signature = 'onboarding:reset';

    protected $description = 'Reset onboarding status to allow re-initialization';

    public function handle()
    {
        // CLAUDE.md Punkt 6 / bekannte Falle: in Commands ist tenant() null,
        // der BelongsToTenant-Global-Scope greift daher NICHT - first() liefert
        // hier bewusst (wie vor SPEC-07) den ersten Datensatz der Tabelle ohne
        // Tenant-Filter (bestehendes Verhalten, hier nicht Teil des Fixes).
        // Für die Cache-Invalidierung wird trotzdem die tenant_id der
        // gefundenen Zeile verwendet (kein tenant()-Aufruf nötig).
        $settings = CompanySetting::first();

        if (! $settings) {
            $this->error('No company settings found.');

            return 1;
        }

        $settings->account_plan_initialized_at = null;
        $settings->account_plan_last_updated_at = null;
        $settings->onboarding_completed = false;
        $settings->business_models = null;
        $settings->legal_form = null;
        $settings->save();

        // SPEC-07 (7.3): Onboarding-Cache des betroffenen Tenants invalidieren
        // (zusätzlich zum saved()-Hook auf CompanySetting selbst).
        if ($settings->tenant_id !== null) {
            Cache::forget(OnboardingMiddleware::cacheKey($settings->tenant_id));
        }

        $this->info('✅ Onboarding wurde zurückgesetzt!');
        $this->info('Sie können jetzt das Onboarding erneut durchführen.');

        return 0;
    }
}
