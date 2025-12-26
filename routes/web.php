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

// Tenant-specific routes (path-based: /{tenant}/...)
Route::prefix('{tenant}')->group(function () {
    // Serve React App for all tenant routes (React Router handles routing)
    Route::get('/{any?}', function () {
        return view('app');
    })->where('any', '.*');
});

// Root route - redirect to login or show welcome page
Route::get('/', function () {
    if (auth()->check()) {
        $tenant = auth()->user()->tenant;
        if ($tenant) {
            return redirect('/' . $tenant->slug . '/dashboard');
        }
    }
    return view('app'); // This will show the welcome/login page
});
