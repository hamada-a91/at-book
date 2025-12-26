<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Fix Belege Table
        Schema::table('belege', function (Blueprint $table) {
            // Drop old global unique constraint safely
            try {
                // Try standard naming convention first
                $table->dropUnique('belege_document_number_unique');
            } catch (\Exception $e) {
                // Fallback for custom naming or missing constraint
                try {
                    $table->dropUnique(['document_number']);
                } catch (\Exception $e2) {
                    // Try raw SQL for PostgreSQL safety
                    DB::statement('ALTER TABLE belege DROP CONSTRAINT IF EXISTS belege_document_number_unique');
                }
            }
            
            // Add new composite unique constraint (tenant_id + document_number)
            try {
                $table->unique(['tenant_id', 'document_number']);
            } catch (\Exception $e) {
                // Constraint might already exist
            }
        });

        // 2. Fix Invoices Table
        Schema::table('invoices', function (Blueprint $table) {
            // Drop old global unique constraint safely
            try {
                $table->dropUnique('invoices_invoice_number_unique');
            } catch (\Exception $e) {
                try {
                    $table->dropUnique(['invoice_number']);
                } catch (\Exception $e2) {
                    DB::statement('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_unique');
                }
            }
            
            // Add new composite unique constraint (tenant_id + invoice_number)
            try {
                $table->unique(['tenant_id', 'invoice_number']);
            } catch (\Exception $e) {
                // Constraint might already exist
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('belege', function (Blueprint $table) {
            $table->dropUnique(['tenant_id', 'document_number']);
            $table->unique('document_number');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropUnique(['tenant_id', 'invoice_number']);
            $table->unique('invoice_number');
        });
    }
};
