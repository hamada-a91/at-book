<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;

class CompanySettingController extends Controller
{
    public function index()
    {
        $settings = CompanySetting::first();
        
        if (!$settings) {
            // Return default settings
            return response()->json([
                'company_name' => 'Vorpoint',
                'address' => 'Gorkistraße 84, 04347 Leipzig',
                'email' => 'ahmed.tahhan@web.de',
                'phone' => '01608304048',
                'tax_number' => '333333333333',
                'logo_url' => null,
            ]);
        }
        
        return response()->json($settings);
    }
}
