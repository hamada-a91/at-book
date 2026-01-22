<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/**
 * RegistrationController
 * 
 * Handles new tenant registration with JWT authentication
 */
class RegistrationController extends Controller
{
    public function register(Request $request)
    {
        // Validate
        $validator = Validator::make($request->all(), [
            'company_name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:tenants,slug', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        if (env('ENABLE_SERIAL_NUMBER_ACTIVATION', false)) {
            $validator->addRules([
                'serial_number' => [
                    'required',
                    'string',
                    'exists:serial_numbers,serial_number',
                    function ($attribute, $value, $fail) {
                        $serial = \App\Models\SerialNumber::where('serial_number', $value)->first();
                        if ($serial && $serial->is_used) {
                            $fail('This serial number has already been used.');
                        }
                    },
                ],
            ]);
        }

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $result = DB::transaction(function () use ($request) {
                // Check serial number usage again within transaction to prevent race conditions
                if (env('ENABLE_SERIAL_NUMBER_ACTIVATION', false)) {
                     $serial = \App\Models\SerialNumber::where('serial_number', $request->serial_number)->lockForUpdate()->first();
                     if (!$serial || $serial->is_used) {
                         throw new \Exception('Serial number invalid or already used.');
                     }
                }

                // Create tenant
                $tenant = Tenant::create([
                    'name' => $request->company_name,
                    'slug' => $request->slug ?? Tenant::generateSlug($request->company_name),
                ]);

                // Create user
                $user = User::create([
                    'name' => $request->name,
                    'email' => $request->email,
                    'password' => Hash::make($request->password),
                    'tenant_id' => $tenant->id,
                ]);

                $user->assignRole('owner');

                // Mark serial number as used
                if (isset($serial)) {
                    $serial->update([
                        'is_used' => true,
                        'used_by_user_id' => $user->id,
                    ]);
                }

                // Create company settings
                app()->instance('currentTenant', $tenant);
                \App\Models\CompanySetting::create([
                    'company_name' => $request->company_name,
                    'tenant_id' => $tenant->id,
                ]);

                return ['tenant' => $tenant, 'user' => $user];
            });

            // Log in and create JWT token
            auth()->login($result['user']);
            $token = auth('api')->login($result['user']);

            return response()->json([
                'message' => 'Registration successful',
                'tenant' => $result['tenant'],
                'user' => $result['user'],
                'token' => $token,
                'redirect' => '/' . $result['tenant']->slug . '/onboarding',
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Registration failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
