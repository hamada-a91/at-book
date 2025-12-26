<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;

Route::get('/force-schema-fix', function () {
    try {
        Schema::table('accounts', function (Blueprint $table) {
            // Drop old unique constraint
             $table->dropUnique('accounts_code_unique');
        });
        
        Schema::table('accounts', function (Blueprint $table) {
             // Add new composite unique
             $table->unique(['tenant_id', 'code']);
        });

        // Also mark migration as run so it doesn't try again
        DB::table('migrations')->insertOrIgnore([
            'migration' => '2025_12_26_122048_fix_accounts_unique_constraint',
            'batch' => 999
        ]);
        
        return 'Schema fixed successfully';
    } catch (\Exception $e) {
        return 'Error: ' . $e->getMessage();
    }
});
