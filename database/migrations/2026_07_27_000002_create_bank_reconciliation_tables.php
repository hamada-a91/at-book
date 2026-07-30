<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_import_batches', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bank_account_id')->constrained('bank_accounts')->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('filename');
            $table->json('settings')->nullable();
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('imported_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->json('skipped_rows')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'created_at']);
        });

        Schema::create('bank_transactions', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bank_account_id')->constrained('bank_accounts')->restrictOnDelete();
            $table->foreignId('import_batch_id')->nullable()->constrained('bank_import_batches')->nullOnDelete();
            $table->date('booking_date');
            $table->date('value_date')->nullable();
            $table->string('counterparty')->nullable();
            $table->text('purpose')->nullable();
            $table->bigInteger('amount');
            $table->string('currency', 3)->default('EUR');
            $table->string('fingerprint');
            $table->enum('status', ['unmatched', 'matched', 'ignored'])->default('unmatched');
            $table->string('matched_type')->nullable();
            $table->unsignedBigInteger('matched_id')->nullable();
            $table->foreignId('journal_entry_id')->nullable()->constrained('journal_entries')->nullOnDelete();
            $table->json('raw');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'fingerprint']);
            $table->index(['tenant_id', 'status', 'booking_date']);
            $table->index(['tenant_id', 'bank_account_id', 'booking_date']);
            $table->index(['tenant_id', 'matched_type', 'matched_id']);
        });

        Schema::create('bank_matching_rules', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->enum('match_on', ['counterparty', 'purpose']);
            $table->string('pattern');
            $table->enum('target_type', ['category', 'contact']);
            $table->foreignId('target_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('target_contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->boolean('auto_book')->default(false);
            $table->unsignedTinyInteger('confidence')->default(90);
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'match_on', 'pattern', 'target_type'], 'bank_rules_unique_pattern');
            $table->index(['tenant_id', 'match_on']);
        });

        if (Schema::hasTable('payments') && Schema::hasColumn('payments', 'bank_transaction_id')) {
            $driver = DB::connection()->getDriverName();
            if ($driver !== 'sqlite') {
                Schema::table('payments', function (Blueprint $table) {
                    $table->foreign('bank_transaction_id')
                        ->references('id')
                        ->on('bank_transactions')
                        ->nullOnDelete();
                });
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('payments') && Schema::hasColumn('payments', 'bank_transaction_id')) {
            $driver = DB::connection()->getDriverName();
            if ($driver !== 'sqlite') {
                Schema::table('payments', function (Blueprint $table) {
                    $table->dropForeign(['bank_transaction_id']);
                });
            }
        }

        Schema::dropIfExists('bank_matching_rules');
        Schema::dropIfExists('bank_transactions');
        Schema::dropIfExists('bank_import_batches');
    }
};
