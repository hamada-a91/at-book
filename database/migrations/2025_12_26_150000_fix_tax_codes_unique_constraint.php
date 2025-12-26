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
        // 1. Drop old constraint safely
        try {
            // Postgres specific safe drop
            \Illuminate\Support\Facades\DB::statement('ALTER TABLE tax_codes DROP CONSTRAINT IF EXISTS tax_codes_code_unique');
        } catch (\Throwable $e) {
            // Fallback
            try {
                Schema::table('tax_codes', function (Blueprint $table) {
                    $table->dropUnique(['code']);
                });
            } catch (\Throwable $e2) {}
        }

        // 2. Add new scoped constraint
        Schema::table('tax_codes', function (Blueprint $table) {
            try {
                $table->unique(['tenant_id', 'code']);
            } catch (\Throwable $e) {
                // Ignore
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tax_codes', function (Blueprint $table) {
            $table->dropUnique(['tenant_id', 'code']);
            $table->unique('code', 'tax_codes_code_unique');
        });
    }
};
