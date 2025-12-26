<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * This data migration assigns all existing records to a default tenant.
     */
    public function up(): void
    {
        // Create the default tenant
        $tenantId = DB::table('tenants')->insertGetId([
            'name' => 'Default Tenant',
            'slug' => 'default',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Assign all existing users to the default tenant
        DB::table('users')->update(['tenant_id' => $tenantId]);

        // Assign all existing records in tenant-scoped tables to the default tenant
        $tables = [
            'accounts',
            'journal_entries',
            'contacts',
            'invoices',
            'belege',
            'bank_accounts',
            'company_settings',
            'tax_codes',
        ];

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->update(['tenant_id' => $tenantId]);
            }
        }

        // Make tenant_id NOT NULL after assigning all records
        Schema::table('users', function ($table) {
            $table->foreignId('tenant_id')->nullable(false)->change();
        });

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                Schema::table($table, function ($blueprint) {
                    $blueprint->foreignId('tenant_id')->nullable(false)->change();
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Make tenant_id nullable again
        Schema::table('users', function ($table) {
            $table->foreignId('tenant_id')->nullable()->change();
        });

        $tables = [
            'accounts',
            'journal_entries',
            'contacts',
            'invoices',
            'belege',
            'bank_accounts',
            'company_settings',
            'tax_codes',
        ];

        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                Schema::table($table, function ($blueprint) {
                    $blueprint->foreignId('tenant_id')->nullable()->change();
                });
            }
        }

        // Delete the default tenant
        DB::table('tenants')->where('slug', 'default')->delete();
    }
};
