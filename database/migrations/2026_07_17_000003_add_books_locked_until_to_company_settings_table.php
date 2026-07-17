<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC-05 (Teil B): Periodenfestschreibung. Alle Buchungen mit
 * booking_date <= books_locked_until gelten als festgeschrieben; der Zeitraum
 * ist für neue Erfassung gesperrt (BookingService::createBooking()). Monoton
 * (kann nur vorwärts wandern) - wird in BookingService::lockPeriod() geprüft,
 * nicht per DB-Constraint (Historie/Vorwerte werden nicht mitgeschrieben).
 *
 * Backup: CompanySettingTransformer wird um books_locked_until erweitert;
 * alte Backups ohne das Feld liefern beim Import null (= keine Periodensperre,
 * dokumentiert in docs/specs/SPEC-05-nummernkreise.md, Backup-Impact Punkt 3).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->date('books_locked_until')->nullable()->after('onboarding_completed');
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn('books_locked_until');
        });
    }
};
