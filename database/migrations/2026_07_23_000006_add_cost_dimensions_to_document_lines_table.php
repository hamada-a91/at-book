<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC-08 (Teil A): optionale Zeilen-eigene Kostenstelle/Kostenträger auf den
 * Positionszeilen von Rechnung/Beleg/Angebot/Auftrag - überschreiben beim
 * Buchen den Dokument-Default (documents.project_id -> dessen
 * cost_object_id), siehe Durchreich-Logik in InvoiceBookingService/
 * BelegController::book().
 */
return new class extends Migration
{
    private const TABLES = ['invoice_lines', 'beleg_lines', 'quote_lines', 'order_lines'];

    public function up(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignId('cost_center_id')->nullable()
                    ->constrained('cost_centers')->restrictOnDelete();
                $table->foreignId('cost_object_id')->nullable()
                    ->constrained('cost_objects')->restrictOnDelete();

                $table->index('cost_center_id');
                $table->index('cost_object_id');
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropConstrainedForeignId('cost_center_id');
                $table->dropConstrainedForeignId('cost_object_id');
            });
        }
    }
};
