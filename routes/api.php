<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;

// Schema Fix Route (Temporary)
Route::get('/force-schema-fix', function () {
    $messages = [];
    
    if (Schema::hasTable('accounts')) {
        // 1. Try to drop old unique constraint
        try {
            Schema::table('accounts', function (Illuminate\Database\Schema\Blueprint $table) {
                $table->dropUnique('accounts_code_unique');
            });
            $messages[] = 'Dropped accounts_code_unique';
        } catch (\Exception $e) {
            $messages[] = 'Drop failed (might not exist): ' . $e->getMessage();
        }
        
        // 2. Try to add new scoped unique constraint
        try {
            Schema::table('accounts', function (Illuminate\Database\Schema\Blueprint $table) {
                $table->unique(['tenant_id', 'code']);
            });
             $messages[] = 'Added unique(tenant_id, code)';
        } catch (\Exception $e) {
             $messages[] = 'Add unique failed (might exist): ' . $e->getMessage();
        }
        // 3. Fix Tax Codes table similarly
        if (Schema::hasTable('tax_codes')) {
            try {
                Schema::table('tax_codes', function (Illuminate\Database\Schema\Blueprint $table) {
                    $table->dropUnique('tax_codes_code_unique');
                });
                $messages[] = 'Dropped tax_codes_code_unique';
            } catch (\Exception $e) {
                $messages[] = 'Drop tax_unique failed: ' . $e->getMessage();
            }
            
            try {
                Schema::table('tax_codes', function (Illuminate\Database\Schema\Blueprint $table) {
                    $table->unique(['tenant_id', 'code']);
                });
                $messages[] = 'Added unique(tenant_id, code) to tax_codes';
            } catch (\Exception $e) {
                $messages[] = 'Add tax_unique failed: ' . $e->getMessage();
            }
        }
    }
    
    return response()->json(['messages' => $messages]);
});
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AccountBalanceController;
use App\Http\Controllers\Api\JournalEntryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\CompanySettingController;
use App\Http\Controllers\Api\ReportsController;
use App\Http\Controllers\Api\AccountPlanController;
use App\Http\Controllers\Api\OnboardingController;
use App\Http\Controllers\Auth\RegistrationController;
use App\Http\Controllers\Auth\LoginController;

// ===== PUBLIC AUTHENTICATION ROUTES =====
Route::post('/register', [RegistrationController::class, 'register'])->name('api.register');
Route::post('/login', [LoginController::class, 'login'])->name('api.login');
Route::post('/logout', [LoginController::class, 'logout'])->middleware('auth:api')->name('api.logout');
Route::get('/user', [LoginController::class, 'user'])->middleware('auth:api')->name('api.user');

Route::middleware(['api', 'auth:api', \App\Http\Middleware\SetTenantFromUser::class])->group(function () {
    // ===== UNPROTECTED ROUTES (accessible during onboarding) =====
    
    // Note: auth:sanctum supports BOTH session auth (web) AND token auth (API)
    // This allows the frontend to call these routes during onboarding (session)
    // and also via API tokens after login
    
    // Onboarding Status
    Route::get('/onboarding/status', [OnboardingController::class, 'status']);
    Route::post('/onboarding/complete', [OnboardingController::class, 'complete']);
    
    // Company Settings (needed for onboarding)
    Route::get('/settings', [CompanySettingController::class, 'show']);
    Route::post('/settings', [CompanySettingController::class, 'update']);
    
    // Account Plan Management
    Route::post('/account-plan/generate', [AccountPlanController::class, 'generate']);
    Route::post('/account-plan/extend', [AccountPlanController::class, 'extend']);
    Route::get('/account-plan/status', [AccountPlanController::class, 'status']);
    Route::get('/account-plan/missing', [AccountPlanController::class, 'missing']);
    
    // ===== PROTECTED ROUTES (require completed onboarding) =====
    Route::middleware(['onboarding.complete'])->group(function () {
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
        Route::post('/invoices/{invoice}/send', [\App\Http\Controllers\Api\InvoiceController::class, 'send']);
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

        // Inventory Report
        Route::get('/inventory-report', [\App\Http\Controllers\Api\InventoryReportController::class, 'index']);

        // Products & Inventory
        Route::apiResource('products', \App\Http\Controllers\Api\ProductController::class);
        
        // Product Categories
        Route::get('/product-categories', [\App\Http\Controllers\Api\ProductCategoryController::class, 'index']);
        Route::post('/product-categories', [\App\Http\Controllers\Api\ProductCategoryController::class, 'store']);
        Route::put('/product-categories/{id}', [\App\Http\Controllers\Api\ProductCategoryController::class, 'update']);
        Route::delete('/product-categories/{id}', [\App\Http\Controllers\Api\ProductCategoryController::class, 'destroy']);

        // Bank Accounts
        Route::apiResource('bank-accounts', \App\Http\Controllers\Api\BankAccountController::class);
        Route::post('/bank-accounts/{id}/set-default', [\App\Http\Controllers\Api\BankAccountController::class, 'setDefault']);

        // Quotes (Angebote)
        Route::apiResource('quotes', \App\Http\Controllers\Api\QuoteController::class);
        Route::post('/quotes/{quote}/send', [\App\Http\Controllers\Api\QuoteController::class, 'send']);
        Route::post('/quotes/{quote}/accept', [\App\Http\Controllers\Api\QuoteController::class, 'accept']);
        Route::post('/quotes/{quote}/create-order', [\App\Http\Controllers\Api\QuoteController::class, 'createOrder']);
        Route::get('/quotes/{id}/download-pdf', [\App\Http\Controllers\Api\QuoteController::class, 'downloadPDF']);

        // Orders (Aufträge)
        Route::apiResource('orders', \App\Http\Controllers\Api\OrderController::class);
        Route::post('/orders/{order}/send', [\App\Http\Controllers\Api\OrderController::class, 'send']);
        Route::post('/orders/{order}/create-delivery-note', [\App\Http\Controllers\Api\OrderController::class, 'createDeliveryNote']);
        Route::post('/orders/{order}/create-invoice', [\App\Http\Controllers\Api\OrderController::class, 'createInvoice']);
        Route::get('/orders/{id}/download-pdf', [\App\Http\Controllers\Api\OrderController::class, 'downloadPDF']);

        // Delivery Notes (Lieferscheine)
        Route::apiResource('delivery-notes', \App\Http\Controllers\Api\DeliveryNoteController::class);
        Route::post('/delivery-notes/{deliveryNote}/create-invoice', [\App\Http\Controllers\Api\DeliveryNoteController::class, 'createInvoice']);
        
        // Role & User Management
        Route::get('/roles', [\App\Http\Controllers\Api\RoleController::class, 'index']);
        Route::apiResource('users', \App\Http\Controllers\Api\UserController::class);
    });
});
