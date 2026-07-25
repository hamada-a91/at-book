<?php

use App\Http\Controllers\Api\AccountBalanceController;
use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AccountPlanController;
use App\Http\Controllers\Api\CompanySettingController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\JournalEntryController;
use App\Http\Controllers\Api\OnboardingController;
use App\Http\Controllers\Api\ReportsController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegistrationController;
use Illuminate\Support\Facades\Route;

// ===== PUBLIC AUTHENTICATION ROUTES =====
Route::post('/register', [RegistrationController::class, 'register'])->name('api.register');
Route::post('/login', [LoginController::class, 'login'])->name('api.login');
Route::post('/logout', [LoginController::class, 'logout'])->middleware('auth:api')->name('api.logout');
Route::get('/user', [LoginController::class, 'user'])->middleware('auth:api')->name('api.user');
Route::get('/config', [\App\Http\Controllers\PublicConfigController::class, 'index']);

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
            // SPEC-08 (Teil A)
            Route::get('/cost-centers', [ReportsController::class, 'costCenters']);
            Route::get('/projects/{project}/profitability', [ReportsController::class, 'projectProfitability']);
        });

        // Projekte, Kostenstellen & Kostenträger (SPEC-08, Teil A)
        // index/show offen für alle angemeldeten Rollen (u.a. für die
        // Projekt-Auswahl beim Erfassen von Belegen/Rechnungen); Schreib-Routen
        // (store/update/destroy) auf owner|manager|buchhalter beschränkt -
        // analog zum bestehenden Muster bei /bookings/lock-period und
        // /audit-logs oben.
        Route::apiResource('cost-centers', \App\Http\Controllers\Api\CostCenterController::class)->only(['index', 'show']);
        Route::apiResource('cost-centers', \App\Http\Controllers\Api\CostCenterController::class)
            ->only(['store', 'update', 'destroy'])
            ->middleware('role:owner|manager|buchhalter,api');

        Route::apiResource('cost-objects', \App\Http\Controllers\Api\CostObjectController::class)->only(['index', 'show']);
        Route::apiResource('cost-objects', \App\Http\Controllers\Api\CostObjectController::class)
            ->only(['store', 'update', 'destroy'])
            ->middleware('role:owner|manager|buchhalter,api');

        Route::apiResource('projects', \App\Http\Controllers\Api\ProjectController::class)->only(['index', 'show']);
        Route::apiResource('projects', \App\Http\Controllers\Api\ProjectController::class)
            ->only(['store', 'update', 'destroy'])
            ->middleware('role:owner|manager|buchhalter,api');

        Route::get('/projects/{project}/summary', [\App\Http\Controllers\Api\ProjectController::class, 'summary']);
        Route::get('/projects/{project}/entries', [\App\Http\Controllers\Api\ProjectController::class, 'entries']);
        Route::get('/projects/{project}/cost-report', [\App\Http\Controllers\Api\ProjectController::class, 'costReport']);
        // TODO(Teil B): GET /projects/{project}/cost-report/pdf (dompdf, Muster invoices.pdf)
        // TODO(Teil B): POST /projects/{project}/cost-report/send (SendDocumentMail, Muster InvoiceController::send)

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
        // SPEC-05 (Teil B): vor /bookings/{id} registriert, sonst würde die
        // {id}-Route "lock-status" als ID interpretieren.
        Route::get('/bookings/lock-status', [JournalEntryController::class, 'lockStatus']);
        Route::post('/bookings/lock-period', [JournalEntryController::class, 'lockPeriod'])->middleware('role:owner|buchhalter,api');
        Route::get('/bookings/{id}', [JournalEntryController::class, 'show']);
        Route::post('/bookings', [JournalEntryController::class, 'store']);
        Route::post('/bookings/{id}/lock', [JournalEntryController::class, 'lock']);
        Route::post('/bookings/{id}/reverse', [JournalEntryController::class, 'reverse']);

        // Audit-Log (SPEC-06)
        Route::get('/audit-logs', [\App\Http\Controllers\Api\AuditLogController::class, 'index'])->middleware('role:owner|buchhalter,api');

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
        Route::apiResource('bug-reports', \App\Http\Controllers\Api\BugReportController::class)->only(['index', 'store']);

        // Backup & Restore
        Route::prefix('backup')->group(function () {
            // Export
            Route::post('/export', [\App\Http\Controllers\Api\BackupController::class, 'startExport']);

            // Jobs
            Route::get('/jobs', [\App\Http\Controllers\Api\BackupController::class, 'listJobs']);
            Route::get('/jobs/{id}', [\App\Http\Controllers\Api\BackupController::class, 'getJob']);
            Route::get('/jobs/{id}/download-url', [\App\Http\Controllers\Api\BackupController::class, 'getDownloadUrl']);
            Route::delete('/jobs/{id}', [\App\Http\Controllers\Api\BackupController::class, 'deleteBackup']);
            Route::post('/jobs/{id}/cancel', [\App\Http\Controllers\Api\BackupController::class, 'cancelJob']);

            // Import
            Route::post('/import/upload', [\App\Http\Controllers\Api\BackupController::class, 'uploadImport']);
            Route::post('/import/{id}/validate', [\App\Http\Controllers\Api\BackupController::class, 'validateImport']);
            Route::post('/import/{id}/start', [\App\Http\Controllers\Api\BackupController::class, 'startImport']);
        });
    });
});

// Public backup download (uses signed token, no auth required)
Route::get('/backup/download/{id}', [\App\Http\Controllers\Api\BackupController::class, 'downloadBackupSigned']);

// Admin Routes - Outside tenant middleware (global access)
Route::middleware(['auth:api', 'role:admin,api'])->prefix('admin')->group(function () {
    Route::get('/stats', [\App\Http\Controllers\Api\AdminController::class, 'stats']);
    Route::get('/tenants', [\App\Http\Controllers\Api\AdminController::class, 'tenants']);
    Route::get('/users', [\App\Http\Controllers\Api\AdminController::class, 'users']);
    Route::get('/bug-reports', [\App\Http\Controllers\Api\AdminController::class, 'bugReports']);
    Route::patch('/bug-reports/{id}', [\App\Http\Controllers\Api\AdminController::class, 'updateBugReport']);

    // Serial Numbers
    Route::get('/serial-numbers', [\App\Http\Controllers\Api\Admin\SerialNumberController::class, 'index']);
    Route::post('/serial-numbers', [\App\Http\Controllers\Api\Admin\SerialNumberController::class, 'store']);
    Route::delete('/serial-numbers/{id}', [\App\Http\Controllers\Api\Admin\SerialNumberController::class, 'destroy']);

    // User Blocking
    Route::post('/users/{id}/block', [\App\Http\Controllers\Api\AdminController::class, 'blockUser']);
    Route::post('/users/{id}/unblock', [\App\Http\Controllers\Api\AdminController::class, 'unblockUser']);
});
