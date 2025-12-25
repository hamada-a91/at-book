<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class OnboardingController extends Controller
{
    /**
     * Prüft den Onboarding-Status
     * 
     * GET /api/onboarding/status
     */
    public function status()
    {
        $settings = \App\Models\CompanySetting::first();
        
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
        
        // Prüfe jeden Schritt
        $steps = [
            'company_data' => !empty($settings->company_name) && !empty($settings->city),
            'tax_settings' => true, // Optional - kann später ausgefüllt werden
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
    
    /**
     * Schließt den Onboarding-Prozess ab
     * 
     * POST /api/onboarding/complete
     */
    public function complete()
    {
        $settings = \App\Models\CompanySetting::first();
        
        if (!$settings) {
            return response()->json([
                'message' => 'Bitte füllen Sie zuerst die Firmendaten aus'
            ], 400);
        }
        
        // Validiere, dass alle Pflichtfelder ausgefüllt sind
        if (empty($settings->company_name)) {
            return response()->json([
                'message' => 'Firmenname fehlt',
                'step' => 'company_data'
            ], 400);
        }
        
        // Steuernummer ist OPTIONAL - kann später in Settings hinzugefügt werden
        // if (empty($settings->tax_number)) {
        //     return response()->json([
        //         'message' => 'Steuernummer fehlt',
        //         'step' => 'tax_settings'
        //     ], 400);
        // }
        
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
        
        // Erstelle einen Standard-User falls keiner existiert
        // Dies ist wichtig für Journal Entries, die einen user_id benötigen
        if (\App\Models\User::count() === 0) {
            \App\Models\User::create([
                'name' => $settings->company_name ?? 'Admin',
                'email' => $settings->email ?? 'admin@' . str_replace(' ', '', strtolower($settings->company_name ?? 'company')) . '.local',
                'password' => bcrypt('password'),
                'email_verified_at' => now(),
            ]);
        }
        
        // Markiere Onboarding als abgeschlossen
        $settings->onboarding_completed = true;
        $settings->save();
        
        return response()->json([
            'message' => 'Onboarding erfolgreich abgeschlossen',
            'completed' => true,
            'redirect_to' => '/dashboard'
        ]);
    }
}
