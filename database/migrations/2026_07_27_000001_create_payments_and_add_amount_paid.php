<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', fn (Blueprint $table) => $table->bigInteger('amount_paid')->default(0)->after('total'));
        Schema::table('belege', fn (Blueprint $table) => $table->bigInteger('amount_paid')->default(0)->after('amount'));

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->enum('payable_type', ['invoice', 'beleg']);
            $table->unsignedBigInteger('payable_id');
            $table->bigInteger('amount');
            $table->date('payment_date');
            $table->foreignId('payment_account_id')->constrained('accounts')->restrictOnDelete();
            $table->foreignId('journal_entry_id')->constrained('journal_entries')->restrictOnDelete();
            // SPEC-12 erg?nzt den FK, sobald bank_transactions existiert.
            $table->unsignedBigInteger('bank_transaction_id')->nullable()->index();
            $table->bigInteger('discount_amount')->default(0);
            $table->foreignId('discount_account_id')->nullable()->constrained('accounts')->restrictOnDelete();
            $table->foreignId('reversal_journal_entry_id')->nullable()->constrained('journal_entries')->restrictOnDelete();
            $table->timestamp('reversed_at')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'payable_type', 'payable_id', 'payment_date'], 'payments_payable_date_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::table('belege', fn (Blueprint $table) => $table->dropColumn('amount_paid'));
        Schema::table('invoices', fn (Blueprint $table) => $table->dropColumn('amount_paid'));
    }
};
