<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\HasTenantScope;
use Illuminate\Http\Request;

class OnboardingController extends Controller
{
    use HasTenantScope;

    public function status()
    {
        // Get tenant-specific settings
        $tenant = $this->getTenantOrFail();
        $settings = \App\Models\CompanySetting::where('tenant_id', $tenant->id)->first();
        
        if (!$settings) {
            return response()->json([
                'completed' => false,
                'steps' => [
                    'company_data' => false,
                    'tax_settings' => false,
                    'business_model' => false,
                    'legal_form' => false,
                    'account_plan' => false
                ],
                'message' => 'Onboarding nicht gestartet'
            ]);
        }
        
        // Check each step
        $steps = [
            'company_data' => !empty($settings->company_name) && !empty($settings->city),
            'tax_settings' => true, // Optional
            'business_model' => !empty($settings->business_models),
            'legal_form' => !empty($settings->legal_form),
            'account_plan' => !empty($settings->account_plan_initialized_at)
        ];
        
        $allComplete = !in_array(false, $steps, true);
        
        return response()->json([
            'completed' => $allComplete && $settings->onboarding_completed,
            'steps' => $steps,
            'settings' => [
                'company_name' => $settings->company_name,
                'business_models' => json_decode($settings->business_models, true),
                'legal_form' => $settings->legal_form,
                'account_plan_initialized_at' => $settings->account_plan_initialized_at
            ]
        ]);
    }
    
    public function complete()
    {
        $tenant = $this->getTenantOrFail();
        $settings = \App\Models\CompanySetting::where('tenant_id', $tenant->id)->first();
        
        if (!$settings) {
            return response()->json([
                'message' => 'Bitte füllen Sie zuerst die Firmendaten aus'
            ], 400);
        }
        
        // Validate required fields
        if (empty($settings->company_name)) {
            return response()->json([
                'message' => 'Firmenname fehlt',
                'step' => 'company_data'
            ], 400);
        }
        
        if (empty($settings->business_models)) {
            return response()->json([
                'message' => 'Geschäftsmodell fehlt',
                'step' => 'business_model'
            ], 400);
        }
        
        if (empty($settings->legal_form)) {
            return response()->json([
                'message' => 'Rechtsform fehlt',
                'step' => 'legal_form'
            ], 400);
        }
        
        if (empty($settings->account_plan_initialized_at)) {
            return response()->json([
                'message' => 'Kontenplan muss generiert werden',
                'step' => 'account_plan'
            ], 400);
        }
        
        // Mark onboarding as completed
        $settings->onboarding_completed = true;
        $settings->save();
        
        return response()->json([
            'message' => 'Onboarding erfolgreich abgeschlossen',
            'completed' => true,
            'redirect_to' => "/{$tenant->slug}/dashboard"
        ]);
    }
}
