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
        // Add tenant_id to all tenant-scoped tables
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
                Schema::table($table, function (Blueprint $blueprint) {
                    $blueprint->foreignId('tenant_id')->nullable()->after('id')->constrained('tenants')->onDelete('cascade');
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
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
                Schema::table($table, function (Blueprint $blueprint) {
                    $blueprint->dropForeign(['tenant_id']);
                    $blueprint->dropColumn('tenant_id');
                });
            }
        }
    }
};
