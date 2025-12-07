<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Skr03AccountPlanGenerator;
use App\Modules\Accounting\Models\Account;
use App\Models\TaxCode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountPlanController extends Controller
{
    protected $generator;
    
    public function __construct(Skr03AccountPlanGenerator $generator)
    {
        $this->generator = $generator;
    }
    
    /**
     * Generiert den initialen Kontenplan
     * 
     * POST /api/account-plan/generate
     */
    public function generate(Request $request)
    {
        $validated = $request->validate([
            'business_models' => 'required|array|min:1',
            'business_models.*' => 'in:dienstleistungen,handel,produktion,online,offline,gemischt,allgemein',
            'legal_form' => 'required|in:einzelunternehmen,gbr,ohg,kg,gmbh,ug,ag'
        ]);
        
        // Prüfe, ob bereits initialisiert
        $settings = \App\Models\CompanySetting::first();
        if ($settings && $settings->account_plan_initialized_at) {
            return response()->json([
                'message' => 'Kontenplan wurde bereits initialisiert. Verwenden Sie /api/account-plan/extend um weitere Geschäftsmodelle hinzuzufügen.',
                'initialized_at' => $settings->account_plan_initialized_at
            ], 400);
        }
        
        DB::beginTransaction();
        try {
            // 1. Generiere Konten
            $accountsData = $this->generator->generateAccounts(
                $validated['business_models'],
                $validated['legal_form']
            );
            
            $createdAccounts = [];
            $skippedAccounts = 0;
            
            foreach ($accountsData as $accountData) {
                // Prüfe, ob Konto bereits existiert
                $existing = Account::where('code', $accountData['code'])->first();
                
                if ($existing) {
                    // Konto existiert bereits, überspringe es
                    $skippedAccounts++;
                    continue;
                }
                
                // Erstelle nur neue Konten
                $createdAccounts[] = Account::create($accountData);
            }
            
            // 2. Generiere Steuerschlüssel (nur wenn noch nicht vorhanden)
            $taxCodesData = $this->generator->generateTaxCodes();
            $createdTaxCodes = 0;
            
            foreach ($taxCodesData as $taxData) {
                // Prüfe, ob Tax Code bereits existiert
                if (TaxCode::where('code', $taxData['code'])->exists()) {
                    continue;
                }
                
                // Finde das zugehörige Steuerkonto
                $accountId = null;
                if ($taxData['code'] === 'UST19') {
                    $accountId = Account::where('code', '1776')->first()?->id;
                } elseif ($taxData['code'] === 'UST7') {
                    $accountId = Account::where('code', '1771')->first()?->id;
                } elseif ($taxData['code'] === 'VST19') {
                    $accountId = Account::where('code', '1576')->first()?->id;
                } elseif ($taxData['code'] === 'VST7') {
                    $accountId = Account::where('code', '1571')->first()?->id;
                }
                
                $taxData['account_id'] = $accountId;
                TaxCode::create($taxData);
                $createdTaxCodes++;
            }
            
            // 3. Aktualisiere Company Settings
            if (!$settings) {
                $settings = new \App\Models\CompanySetting();
            }
            
            $settings->business_models = json_encode($validated['business_models']);
            $settings->legal_form = $validated['legal_form'];
            $settings->account_plan_initialized_at = now();
            $settings->save();
            
            DB::commit();
            
            return response()->json([
                'message' => 'Kontenplan erfolgreich generiert',
                'accounts_created' => count($createdAccounts),
                'accounts_skipped' => $skippedAccounts,
                'tax_codes_created' => $createdTaxCodes,
                'business_models' => $validated['business_models'],
                'legal_form' => $validated['legal_form']
            ], 201);
            
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Fehler bei der Kontenplan-Generierung',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Erweitert den Kontenplan um neue Geschäftsmodelle
     * 
     * POST /api/account-plan/extend
     */
    public function extend(Request $request)
    {
        $validated = $request->validate([
            'add_business_models' => 'required|array|min:1',
            'add_business_models.*' => 'in:dienstleistungen,handel,produktion,online,offline,gemischt,allgemein'
        ]);
        
        $settings = \App\Models\CompanySetting::first();
        
        if (!$settings || !$settings->account_plan_initialized_at) {
            return response()->json([
                'message' => 'Kontenplan muss erst initialisiert werden'
            ], 400);
        }
        
        DB::beginTransaction();
        try {
            // 1. Erweitere Kontenplan
            $createdAccounts = $this->generator->extendAccountPlan($validated['add_business_models']);
            
            // 2. Aktualisiere Business Models
            $currentModels = json_decode($settings->business_models, true) ?? [];
            $newModels = array_unique(array_merge($currentModels, $validated['add_business_models']));
            
            $settings->business_models = json_encode($newModels);
            $settings->account_plan_last_updated_at = now();
            $settings->save();
            
            DB::commit();
            
            return response()->json([
                'message' => 'Kontenplan erfolgreich erweitert',
                'added_accounts' => count($createdAccounts),
                'accounts_added' => collect($createdAccounts)->map(function($acc) {
                    return [
                        'code' => $acc->code,
                        'name' => $acc->name,
                        'category' => $acc->category
                    ];
                }),
                'business_models' => $newModels
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Fehler beim Erweitern des Kontenplans',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Prüft den Initialisierungsstatus
     * 
     * GET /api/account-plan/status
     */
    public function status()
    {
        $settings = \App\Models\CompanySetting::first();
        
        if (!$settings || !$settings->account_plan_initialized_at) {
            return response()->json([
                'initialized' => false,
                'message' => 'Kontenplan noch nicht initialisiert'
            ]);
        }
        
        return response()->json([
            'initialized' => true,
            'initialized_at' => $settings->account_plan_initialized_at,
            'last_updated_at' => $settings->account_plan_last_updated_at,
            'business_models' => json_decode($settings->business_models, true),
            'legal_form' => $settings->legal_form,
            'total_accounts' => Account::count(),
            'generated_accounts' => Account::where('is_generated', true)->count()
        ]);
    }
    
    /**
     * Zeigt fehlende Konten für ein Geschäftsmodell
     * 
     * GET /api/account-plan/missing?model=handel
     */
    public function missing(Request $request)
    {
        $validated = $request->validate([
            'model' => 'required|in:dienstleistungen,handel,produktion,online,offline,gemischt,allgemein'
        ]);
        
        $settings = \App\Models\CompanySetting::first();
        if (!$settings || !$settings->legal_form) {
            return response()->json([
                'message' => 'Rechtsform nicht festgelegt'
            ], 400);
        }
        
        // Generiere Konten für dieses Modell
        $accountsData = $this->generator->generateAccounts(
            [$validated['model']],
            $settings->legal_form
        );
        
        // Prüfe, welche fehlen
        $existingCodes = Account::pluck('code')->toArray();
        
        $missingAccounts = array_filter($accountsData, fn($acc) => 
            !in_array($acc['code'], $existingCodes)
        );
        
        return response()->json([
            'model' => $validated['model'],
            'missing_count' => count($missingAccounts),
            'missing_accounts' => array_values(array_map(function($acc) {
                return [
                    'code' => $acc['code'],
                    'name' => $acc['name'],
                    'category' => $acc['category']
                ];
            }, $missingAccounts))
        ]);
    }
}
