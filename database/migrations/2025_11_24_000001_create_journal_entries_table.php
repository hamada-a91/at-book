<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The core ledger table
        Schema::create('journal_entries', function (Blueprint $table) {
            $table->id();
            $table->uuid('batch_id')->index()->comment('Groups split bookings or imported batches');
            $table->date('booking_date');
            $table->string('description');
            $table->string('status')->default('draft'); // 'draft', 'posted', 'cancelled'
            $table->timestamp('locked_at')->nullable()->comment('GoBD: When this entry became immutable');
            $table->foreignId('user_id')->constrained()->comment('Who created this entry');
            $table->timestamps();
            $table->softDeletes(); // Optional, but 'posted' entries should never be hard deleted
        });

        // The individual debit/credit lines
        Schema::create('journal_entry_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('journal_entry_id')->constrained()->cascadeOnDelete();
            $table->foreignId('account_id')->constrained('accounts'); // Assuming 'accounts' table exists
            
            $table->enum('type', ['debit', 'credit']);
            $table->bigInteger('amount')->comment('Amount in cents');
            
            // Tax data must be stored explicitly for reproduction
            $table->string('tax_key')->nullable()->comment('e.g., "UST_19", "VST_19"');
            $table->bigInteger('tax_amount')->default(0)->comment('Tax portion in cents');
            
            $table->timestamps();

            // Index for fast lookups
            $table->index(['account_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_entry_lines');
        Schema::dropIfExists('journal_entries');
    }
};
