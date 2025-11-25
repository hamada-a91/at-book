<?php

use Illuminate\Support\Facades\Route;

// Serve React App for all routes (React Router handles routing)
Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');

