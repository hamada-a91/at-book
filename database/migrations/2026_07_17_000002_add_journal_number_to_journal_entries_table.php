<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC-05 (Teil A): journal_number wird erst bei BookingService::lockBooking()
 * vergeben (Lückenlosigkeit durch Vergabezeitpunkt - siehe NumberSequenceService).
 * Nullable, weil Drafts (noch) keine Nummer haben. Unique je Tenant, erlaubt
 * aber mehrere NULLs (Postgres-Standardverhalten für unique Indizes).
 *
 * Backup: JournalEntryTransformer wird um journal_number erweitert (siehe
 * dortige Änderung) - alte Backups ohne das Feld liefern beim Import null,
 * was für bereits festgeschriebene Alt-Buchungen zulässig ist (dokumentiert
 * in docs/specs/SPEC-05-nummernkreise.md, Backup-Impact Punkt 2).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('journal_entries', function (Blueprint $table) {
            $table->string('journal_number')->nullable()->after('batch_id');
        });

        Schema::table('journal_entries', function (Blueprint $table) {
            $table->unique(['tenant_id', 'journal_number']);
        });
    }

    public function down(): void
    {
        Schema::table('journal_entries', function (Blueprint $table) {
            $table->dropUnique(['tenant_id', 'journal_number']);
            $table->dropColumn('journal_number');
        });
    }
};
