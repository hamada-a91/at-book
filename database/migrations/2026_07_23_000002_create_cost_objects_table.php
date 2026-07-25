<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC-08 (Teil A): Kostenträger (KOST2) - "wofür" (Projekt/Auftrag/
 * Produktlinie). Jedes Projekt bekommt bei Anlage automatisch genau einen
 * eigenen Kostenträger (siehe Project-Model) - Kostenträger können aber auch
 * unabhängig von einem Projekt existieren/verwaltet werden.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cost_objects', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->string('code');
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cost_objects');
    }
};
