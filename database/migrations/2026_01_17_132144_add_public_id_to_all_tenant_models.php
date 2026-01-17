<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * List of tables to add public_id to.
     */
    protected $tables = [
        'tenants',
        'users',
        'invoices',
        'invoice_lines',
        'quotes',
        'quote_lines',
        'orders',
        'order_lines',
        'delivery_notes',
        'delivery_note_lines',
        'belege',
        'beleg_lines',
        'products',
        'product_categories',
        'contacts',
        'accounts',
        'journal_entries',
        'bank_accounts',
        'tax_codes',
        'company_settings',
        'documents',
        'inventory_transactions',
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        foreach ($this->tables as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                    // Check if column exists to avoid errors on re-runs or partial migrations
                    if (!Schema::hasColumn($tableName, 'public_id')) {
                        $table->uuid('public_id')->nullable()->after('id');
                    }
                });
                
                // Add index and unique constraint in a separate step or check if index exists
                // For simplicity in this dev environment, we assume we can just add them.
                // Using a separate schema call to ensure column exists first is safer but here we chain.
                
                 Schema::table($tableName, function (Blueprint $table) {
                    $table->unique('public_id');
                    // Index is automatically created for unique, but if we wanted a non-unique index:
                    // $table->index('public_id');
                 });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach ($this->tables as $tableName) {
            if (Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'public_id')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->dropColumn('public_id');
                });
            }
        }
    }
};
