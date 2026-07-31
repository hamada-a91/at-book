<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_account_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->uuid('public_id')->unique();
            $table->string('report_type', 32);
            $table->string('form_version', 32);
            $table->string('source_type', 32);
            $table->uuid('source_public_id');
            $table->string('target_code', 64);
            $table->string('value_type', 32)->default('balance');
            $table->smallInteger('sign')->default(1);
            $table->date('valid_from')->nullable();
            $table->date('valid_until')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'report_type', 'form_version']);
            $table->unique(
                ['tenant_id', 'report_type', 'form_version', 'source_type', 'source_public_id', 'target_code'],
                'report_account_mappings_unique_source_target'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_account_mappings');
    }
};
