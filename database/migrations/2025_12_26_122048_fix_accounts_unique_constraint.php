<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Parse existing indices via Schema manager to be safe? 
        // Or just use raw SQL which is more robust for 'IF EXISTS' in Postgres.
        
        // 1. Drop old constraint safely
        try {
            // Postgres specific safe drop
            \Illuminate\Support\Facades\DB::statement('ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_code_unique');
        } catch (\Throwable $e) {
            // Fallback: Try dropping validation via Schema if raw SQL fails (e.g. not Postgres)
            try {
                Schema::table('accounts', function (Blueprint $table) {
                    $table->dropUnique(['code']);
                });
            } catch (\Throwable $e2) {}
        }

        // 2. Add new scoped constraint
        Schema::table('accounts', function (Blueprint $table) {
            try {
                $table->unique(['tenant_id', 'code']);
            } catch (\Throwable $e) {
                // Ignore if already exists
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropUnique(['tenant_id', 'code']);
            $table->unique('code');
        });
    }
};
