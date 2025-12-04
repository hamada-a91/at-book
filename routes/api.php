<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AccountBalanceController;
use App\Http\Controllers\Api\JournalEntryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\CompanySettingController;
use App\Http\Controllers\Api\ReportsController;

Route::middleware(['api'])->group(function () {
    // Dashboard
    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    Route::get('/dashboard/chart', [DashboardController::class, 'chart']);
    Route::get('/dashboard/recent-bookings', [DashboardController::class, 'recentBookings']);
    
    // Accounts
    Route::get('/accounts', [AccountController::class, 'index']);
    Route::post('/accounts', [AccountController::class, 'store']);
    Route::get('/accounts/{id}', [AccountController::class, 'show']);
    
    // Account Balances
    Route::get('/accounts/balances', [AccountBalanceController::class, 'index']);
    Route::get('/accounts/{account}/balance', [AccountBalanceController::class, 'show']);

    // Contacts
    Route::apiResource('contacts', ContactController::class);
    
    // Reports Routes
    Route::prefix('reports')->group(function () {
        Route::get('/trial-balance', [ReportsController::class, 'trialBalance']);
        Route::get('/profit-loss', [ReportsController::class, 'profitAndLoss']);
        Route::get('/balance-sheet', [ReportsController::class, 'balanceSheet']);
        Route::get('/journal-export', [ReportsController::class, 'journalExport']);
        Route::get('/account-movements', [ReportsController::class, 'accountMovements']);
        Route::get('/tax-report', [ReportsController::class, 'taxReport']);
    });

    // Invoices
    Route::apiResource('invoices', \App\Http\Controllers\Api\InvoiceController::class);
    Route::put('/invoices/{invoice}', [\App\Http\Controllers\Api\InvoiceController::class, 'update']);
    Route::post('/invoices/{invoice}/book', [\App\Http\Controllers\Api\InvoiceController::class, 'book']);
    Route::post('/invoices/{invoice}/payment', [\App\Http\Controllers\Api\InvoiceController::class, 'recordPayment']);
    Route::get('/invoices/{invoice}/pdf', [\App\Http\Controllers\Api\InvoiceController::class, 'downloadPDF']);

    // Belege (Documents/Receipts)
    Route::apiResource('belege', \App\Http\Controllers\Api\BelegController::class)->parameters(['belege' => 'beleg']);
    Route::post('/belege/{beleg}/book', [\App\Http\Controllers\Api\BelegController::class, 'book']);
    Route::post('/belege/{beleg}/upload', [\App\Http\Controllers\Api\BelegController::class, 'uploadFile']);
    Route::get('/belege/{beleg}/download', [\App\Http\Controllers\Api\BelegController::class, 'downloadFile']);


    // Journal Entries
    Route::get('/bookings', [JournalEntryController::class, 'index']);
    Route::get('/bookings/{id}', [JournalEntryController::class, 'show']);
    Route::post('/bookings', [JournalEntryController::class, 'store']);
    Route::post('/bookings/{id}/lock', [JournalEntryController::class, 'lock']);
    Route::post('/bookings/{id}/reverse', [JournalEntryController::class, 'reverse']);

    // Bank Accounts
    Route::apiResource('bank-accounts', \App\Http\Controllers\Api\BankAccountController::class);
    Route::post('/bank-accounts/{id}/set-default', [\App\Http\Controllers\Api\BankAccountController::class, 'setDefault']);

    // Company Settings
    Route::get('/settings', [CompanySettingController::class, 'show']);
    Route::post('/settings', [CompanySettingController::class, 'update']);
});
