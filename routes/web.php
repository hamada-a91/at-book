<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

// Public authentication routes (no tenant required)


Route::get('/register', function () {
    return view('app');
})->name('register');

Route::get('/login', function () {
    return view('app');
})->name('login');

// Admin Routes - MUST BE BEFORE tenant routes
Route::get('/admin', function () {
    return view('app');
});

Route::get('/admin/dashboard', function () {
    return view('app');
});

Route::get('/admin/{any}', function () {
    return view('app');
})->where('any', '.*');

// Tenant-specific routes (path-based: /{tenant}/...)
Route::get('/{tenant}/{any?}', function () {
    return view('app');
})->where('any', '.*');

// Root route - redirect to login or show welcome page
Route::get('/', function () {
    if (auth()->check()) {
        $user = auth()->user();
        
        // Check if user is admin
        if ($user->hasRole('admin')) {
            return redirect('/admin/dashboard');
        }
        
        $tenant = $user->tenant;
        if ($tenant) {
            return redirect('/' . $tenant->slug . '/dashboard');
        }
    }
    return view('app'); // This will show the welcome/login page
});
