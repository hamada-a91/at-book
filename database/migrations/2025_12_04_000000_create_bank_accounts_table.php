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
        Schema::create('bank_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // e.g., "Geschäftskonto Sparkasse"
            $table->string('bank_name'); // e.g., "Sparkasse Leipzig"
            $table->string('iban', 34); // International Bank Account Number
            $table->string('bic', 11)->nullable(); // Bank Identifier Code
            $table->string('account_number')->nullable(); // Legacy account number
            $table->string('bank_code')->nullable(); // BLZ (Bankleitzahl) for Germany
            $table->string('currency', 3)->default('EUR');
            $table->integer('balance')->default(0); // Balance in cents
            $table->string('type')->default('checking'); // checking, savings, credit_card
            $table->boolean('is_default')->default(false); // Mark default bank account
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            // Ensure only one default account
            $table->index('is_default');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bank_accounts');
    }
};
