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
        // Add product_id column if it doesn't exist
        if (!Schema::hasColumn('beleg_lines', 'product_id')) {
            Schema::table('beleg_lines', function (Blueprint $table) {
                $table->unsignedBigInteger('product_id')->nullable()->after('beleg_id');
                $table->index('product_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('beleg_lines', 'product_id')) {
            Schema::table('beleg_lines', function (Blueprint $table) {
                $table->dropIndex(['product_id']);
                $table->dropColumn('product_id');
            });
        }
    }
};
