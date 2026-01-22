<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Tymon\JWTAuth\Facades\JWTAuth;
use Illuminate\Support\Str;

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

        // Rate Limiting
        $throttleKey = Str::lower($request->input('email')) . '|' . $request->ip();

        if (\Illuminate\Support\Facades\RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = \Illuminate\Support\Facades\RateLimiter::availableIn($throttleKey);
            return response()->json([
                'message' => 'Too many login attempts. Please try again in ' . ceil($seconds / 60) . ' minutes.',
            ], 429);
        }

        // Attempt JWT login
        $credentials = $request->only('email', 'password');
        
        if (!$token = auth('api')->attempt($credentials)) {
            // Increment failure count, clear after 30 minutes (1800 seconds)
            \Illuminate\Support\Facades\RateLimiter::hit($throttleKey, 1800);
            
            return response()->json([
                'message' => 'The provided credentials do not match our records.'
            ], 401);
        }

        // Clear rate limiter on successful login
        \Illuminate\Support\Facades\RateLimiter::clear($throttleKey);

        // Get user and tenant
        $user = auth('api')->user();
        
        // Check if user is manually blocked
        if ($user->blocked_at) {
            auth('api')->logout();
            return response()->json([
                'message' => 'Your account has been blocked. Please contact support.'
            ], 403);
        }

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
