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
        Schema::table('belege', function (Blueprint $table) {
            $table->boolean('is_paid')->default(false)->after('status');
            $table->foreignId('payment_account_id')->nullable()->after('is_paid')->constrained('accounts')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('belege', function (Blueprint $table) {
            $table->dropForeign(['payment_account_id']);
            $table->dropColumn(['is_paid', 'payment_account_id']);
        });
    }
};
