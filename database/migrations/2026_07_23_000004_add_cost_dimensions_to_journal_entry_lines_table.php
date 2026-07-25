<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC-08 (Teil A): Kostenstelle (KOST1) / Kostenträger (KOST2) sitzen an der
 * Buchungszeile, nicht am Dokument-/Buchungskopf (siehe SPEC-08, "Fachliches
 * Modell"). Beide nullable - ohne aktiviertes Modul bzw. ohne Projektbezug
 * bleiben sie leer, das Buchen wird dadurch nicht komplizierter.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('journal_entry_lines', function (Blueprint $table) {
            $table->foreignId('cost_center_id')->nullable()->after('account_id')
                ->constrained('cost_centers')->restrictOnDelete();
            $table->foreignId('cost_object_id')->nullable()->after('cost_center_id')
                ->constrained('cost_objects')->restrictOnDelete();

            $table->index('cost_center_id');
            $table->index('cost_object_id');
        });
    }

    public function down(): void
    {
        Schema::table('journal_entry_lines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cost_center_id');
            $table->dropConstrainedForeignId('cost_object_id');
        });
    }
};
