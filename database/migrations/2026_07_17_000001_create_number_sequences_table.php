<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC-05 (Teil A): Nummernkreise pro Tenant/Typ/Jahr. Race-freie Vergabe über
 * NumberSequenceService::next() mit lockForUpdate() (siehe dort). 'journal' nutzt
 * year=0 (jahresunabhängig, fortlaufend über alle Jahre - siehe Spec).
 *
 * Bewusst KEIN Backup-Transformer/Registry-Eintrag (siehe Backup-Impact in
 * docs/specs/SPEC-05-nummernkreise.md, Punkt 1): last_number wird beim Import
 * stattdessen aus den importierten Dokument-/Journalnummern rekonstruiert
 * (BackupImportService-Erweiterung). Als BelongsToTenant-Model taucht
 * NumberSequence trotzdem im automatischen Vollständigkeits-Scan
 * (BackupRoundtripTest::discoverBelongsToTenantModels) auf - dort bewusst in
 * REGISTRY_EXCEPTIONS eingetragen und begründet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('number_sequences', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // invoice, quote, order, delivery_note, beleg, journal
            $table->unsignedInteger('year'); // 0 = jahresunabhängig (journal)
            $table->unsignedBigInteger('last_number')->default(0);
            $table->string('format')->default('RE-{YYYY}-{NNNN}');
            $table->timestamps();
            $table->unique(['tenant_id', 'type', 'year']);
            $table->index('tenant_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('number_sequences');
    }
};
