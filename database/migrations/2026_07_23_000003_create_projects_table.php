<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC-08 (Teil A): Projekt - Stammdaten-Klammer (Kunde, Budget, Laufzeit) mit
 * genau einem eigenen, automatisch angelegten Kostenträger (cost_object_id,
 * siehe Project::booted()/ProjectController).
 *
 * contact_id ist bewusst NULLABLE: ein Projekt ohne Kunde ist ein internes
 * Projekt (z.B. eigenes Produkt "BieneB") - fachlich identisch zu einem
 * Kundenprojekt, nur der Kosten-Nachweis (Teil B, PDF) hat dann keinen
 * Empfänger.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->string('number');
            $table->string('name');
            $table->foreignId('contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->foreignId('cost_object_id')->constrained('cost_objects')->restrictOnDelete();
            $table->bigInteger('budget_amount')->nullable()->comment('Budget in Cents');
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->enum('status', ['active', 'completed', 'archived'])->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
