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
        Schema::create('backup_jobs', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null'); // User might be deleted, keep history
            $table->enum('type', ['export', 'import'])->index();
            $table->enum('status', ['pending', 'processing', 'completed', 'failed', 'cancelled'])->default('pending');
            $table->unsignedInteger('progress_percent')->default(0);
            $table->string('current_step')->nullable();
            $table->string('file_path')->nullable(); // Storage path relative to disk root
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('checksum')->nullable(); // SHA256
            $table->json('options')->nullable(); // e.g. {include_files: true, import_mode: 'replace'}
            $table->json('stats')->nullable(); // e.g. {invoices: 150}
            $table->text('error_message')->nullable();
            $table->json('error_details')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'type', 'status']);
            $table->index(['status', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('backup_jobs');
    }
};
