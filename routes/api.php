<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AccountBalanceController;
use App\Http\Controllers\Api\JournalEntryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\CompanySettingController;

Route::middleware(['api'])->group(function () {
    // Dashboard
    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    Route::get('/dashboard/chart', [DashboardController::class, 'chart']);
    Route::get('/dashboard/recent-bookings', [DashboardController::class, 'recentBookings']);
    
    // Accounts
    Route::get('/accounts', [AccountController::class, 'index']);
    Route::post('/accounts', [AccountController::class, 'store']);
    
    // Account Balances
    Route::get('/accounts/balances', [AccountBalanceController::class, 'index']);
    Route::get('/accounts/{account}/balance', [AccountBalanceController::class, 'show']);

    // Contacts
    Route::apiResource('contacts', ContactController::class);
    
    // Invoices
    Route::apiResource('invoices', \App\Http\Controllers\Api\InvoiceController::class);
    Route::put('/invoices/{invoice}', [\App\Http\Controllers\Api\InvoiceController::class, 'update']);
    Route::post('/invoices/{invoice}/book', [\App\Http\Controllers\Api\InvoiceController::class, 'book']);
    Route::post('/invoices/{invoice}/payment', [\App\Http\Controllers\Api\InvoiceController::class, 'recordPayment']);
    Route::get('/invoices/{invoice}/pdf', [\App\Http\Controllers\Api\InvoiceController::class, 'downloadPDF']);

    // Company Settings
    Route::get('/settings', [CompanySettingController::class, 'index']);

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
