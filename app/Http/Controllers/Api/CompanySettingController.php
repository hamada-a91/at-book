<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\HasTenantScope;
use App\Models\CompanySetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class CompanySettingController extends Controller
{
    use HasTenantScope;

    public function show()
    {
        try {
            // DEBUG: Log request details
            Log::info('CompanySettingController::show called', [
                'has_auth_header' => request()->hasHeader('Authorization'),
                'auth_header' => request()->header('Authorization') ? 'Bearer ***' : 'MISSING',
                'auth_api_check' => auth('api')->check(),
                'auth_api_id' => auth('api')->id(),
            ]);
            
            $user = auth('api')->user();
            
            Log::info('CompanySettingController::show - user check', [
                'user_exists' => !is_null($user),
                'user_id' => $user?->id,
                'user_email' => $user?->email,
            ]);
            
            if (!$user) {
                Log::warning('CompanySettingController::show - No authenticated user, returning defaults');
                return response()->json([
                    'message' => 'Not authenticated - please login',
                    'debug' => [
                        'auth_check' => auth('api')->check(),
                        'has_token' => request()->hasHeader('Authorization'),
                    ]
                ], 401);
            }

            $user->load('tenant');
            $tenant = $user->tenant;
            
            if (!$tenant) {
                Log::warning('CompanySettingController::show - User has no tenant');
                return $this->defaultSettings();
            }

            // Get settings for this specific tenant
            $settings = CompanySetting::where('tenant_id', $tenant->id)->first();
            
            if (!$settings) {
                // Create default settings for this tenant
                $settings = CompanySetting::create([
                    'tenant_id' => $tenant->id,
                    'company_name' => $tenant->name ?? '',
                    'street' => '',
                    'zip' => '',
                    'city' => '',
                    'country' => 'Deutschland',
                    'email' => '',
                    'phone' => '',
                    'tax_number' => '',
                    'tax_type' => 'kleinunternehmer',
                ]);
            }
            
            return response()->json($settings);
            
        } catch (\Exception $e) {
            Log::error('CompanySettingController::show error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Server error',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'company_name' => 'nullable|string|max:255',
            'street' => 'nullable|string|max:255',
            'zip' => 'nullable|string|max:20',
            'city' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:50',
            'tax_number' => 'nullable|string|max:100',
            'tax_type' => 'required|in:kleinunternehmer,umsatzsteuer_pflichtig',
            'logo' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Get tenant
        $tenant = $this->getTenantOrFail();

        // Get or create settings for this tenant
        $settings = CompanySetting::where('tenant_id', $tenant->id)->first();
        
        if (!$settings) {
            $settings = new CompanySetting();
            $settings->tenant_id = $tenant->id;
        }

        // Update basic fields
        $settings->company_name = $request->input('company_name');
        $settings->street = $request->input('street');
        $settings->zip = $request->input('zip');
        $settings->city = $request->input('city');
        $settings->country = $request->input('country', 'Deutschland');
        $settings->email = $request->input('email');
        $settings->phone = $request->input('phone');
        $settings->tax_number = $request->input('tax_number');
        $settings->tax_type = $request->input('tax_type');

        // Handle logo upload
        if ($request->hasFile('logo')) {
            // Delete old logo if exists
            if ($settings->logo_path && Storage::disk('public')->exists($settings->logo_path)) {
                Storage::disk('public')->delete($settings->logo_path);
            }

            // Store new logo  
            $logoPath = $request->file('logo')->store('logos', 'public');
            $settings->logo_path = $logoPath;
        }

        $settings->save();

        return response()->json([
            'message' => 'Einstellungen erfolgreich gespeichert',
            'data' => $settings
        ]);
    }

    private function defaultSettings()
    {
        return response()->json([
            'company_name' => '',
            'street' => '',
            'zip' => '',
            'city' => '',
            'country' => 'Deutschland',
            'email' => '',
            'phone' => '',
            'tax_number' => '',
            'tax_type' => 'kleinunternehmer',
            'logo_path' => null,
        ]);
    }
}
