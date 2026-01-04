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
        if (!Schema::hasColumn('quote_lines', 'product_id')) {
            Schema::table('quote_lines', function (Blueprint $table) {
                $table->foreignId('product_id')->nullable()->after('quote_id')->constrained('products')->nullOnDelete();
            });
        }

        if (!Schema::hasColumn('order_lines', 'product_id')) {
            Schema::table('order_lines', function (Blueprint $table) {
                $table->foreignId('product_id')->nullable()->after('order_id')->constrained('products')->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('quote_lines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_id');
        });

        Schema::table('order_lines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_id');
        });
    }
};
