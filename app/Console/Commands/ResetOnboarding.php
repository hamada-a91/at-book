<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\CompanySetting;

class ResetOnboarding extends Command
{
    protected $signature = 'onboarding:reset';
    protected $description = 'Reset onboarding status to allow re-initialization';

    public function handle()
    {
        $settings = CompanySetting::first();
        
        if (!$settings) {
            $this->error('No company settings found.');
            return 1;
        }

        $settings->account_plan_initialized_at = null;
        $settings->account_plan_last_updated_at = null;
        $settings->onboarding_completed = false;
        $settings->business_models = null;
        $settings->legal_form = null;
        $settings->save();

        $this->info('✅ Onboarding wurde zurückgesetzt!');
        $this->info('Sie können jetzt das Onboarding erneut durchführen.');
        
        return 0;
    }
}
