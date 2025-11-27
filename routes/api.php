<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\JournalEntryController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\CompanySettingController;

Route::middleware(['api'])->group(function () {
    // Accounts
    Route::get('/accounts', [AccountController::class, 'index']);
    Route::post('/accounts', [AccountController::class, 'store']);

    // Contacts
    Route::apiResource('contacts', ContactController::class);

    // Journal Entries
    Route::get('/bookings', [JournalEntryController::class, 'index']);
    Route::get('/bookings/{id}', [JournalEntryController::class, 'show']);
    Route::post('/bookings', [JournalEntryController::class, 'store']);
    Route::post('/bookings/{id}/lock', [JournalEntryController::class, 'lock']);
    Route::post('/bookings/{id}/reverse', [JournalEntryController::class, 'reverse']);

    // Company Settings
    Route::get('/settings', [CompanySettingController::class, 'show']);
    Route::post('/settings', [CompanySettingController::class, 'update']);
});
