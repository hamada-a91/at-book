<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class CompanySettingController extends Controller
{
    public function show()
    {
        $settings = CompanySetting::first();
        
        if (!$settings) {
            // Create default settings if none exist
            $settings = CompanySetting::create([
                'company_name' => 'AT-Book',
                'street' => '',
                'zip' => '',
                'city' => '',
                'country' => 'Deutschland',
                'tax_type' => 'kleinunternehmer',
            ]);
        }
        
        return response()->json($settings);
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

        $settings = CompanySetting::first();
        
        if (!$settings) {
            $settings = new CompanySetting();
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
}
