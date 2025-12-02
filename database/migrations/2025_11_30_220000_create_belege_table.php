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
        Schema::create('belege', function (Blueprint $table) {
            $table->id();
            $table->string('document_number')->unique();
            $table->enum('document_type', ['ausgang', 'eingang', 'offen', 'sonstige'])->index();
            $table->string('title');
            $table->date('document_date');
            $table->bigInteger('amount')->default(0)->comment('Total amount in cents');
            $table->bigInteger('tax_amount')->default(0)->comment('Tax portion in cents');
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('journal_entry_id')->nullable()->constrained('journal_entries')->nullOnDelete();
            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['draft', 'booked', 'paid', 'cancelled'])->default('draft')->index();
            $table->date('due_date')->nullable()->comment('Due date for payment (mainly for Offene Belege)');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('belege');
    }
};
