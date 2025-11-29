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
        Schema::table('company_settings', function (Blueprint $table) {
            $table->string('tax_number')->nullable()->after('country');
            $table->string('email')->nullable()->after('tax_number');
            $table->string('phone')->nullable()->after('email');
            $table->json('bank_details')->nullable()->after('phone');
            $table->string('invoice_prefix')->default('RE')->after('bank_details');
            $table->text('invoice_footer_text')->nullable()->after('invoice_prefix');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn(['tax_number', 'email', 'phone', 'bank_details', 'invoice_prefix', 'invoice_footer_text']);
        });
    }
};
