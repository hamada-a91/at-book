<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Tymon\JWTAuth\Facades\JWTAuth;

/**
 * LoginController - JWT Authentication
 */
class LoginController extends Controller
{
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Attempt JWT login
        $credentials = $request->only('email', 'password');
        
        if (!$token = auth('api')->attempt($credentials)) {
            return response()->json([
                'message' => 'The provided credentials do not match our records.'
            ], 401);
        }

        // Get user and tenant
        $user = auth('api')->user();
        $user->load('tenant');
        $tenant = $user->tenant;

        if ($user->hasRole('admin')) {
             return response()->json([
                'message' => 'Login successful',
                'user' => $user,
                'tenant' => null, // Admin is global
                'token' => $token,
                'redirect' => '/admin/dashboard',
            ]);
        }

        if (!$tenant) {
            JWTAuth::invalidate($token);
            return response()->json([
                'message' => 'User is not associated with a tenant'
            ], 403);
        }

        return response()->json([
            'message' => 'Login successful',
            'user' => $user,
            'tenant' => $tenant,
            'token' => $token,
            'redirect' => '/' . $tenant->slug . '/dashboard',
        ]);
    }

    public function logout(Request $request)
    {
        try {
            JWTAuth::invalidate(JWTAuth::getToken());
            
            return response()->json([
                'message' => 'Logged out successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Logout failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function user(Request $request)
    {
        $user = auth('api')->user();
        
        if ($user) {
            $user->load('tenant');
        }
        
        return response()->json([
            'user' => $user,
            'tenant' => $user?->tenant,
        ]);
    }
}
