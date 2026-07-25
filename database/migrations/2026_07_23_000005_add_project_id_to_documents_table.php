<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC-08 (Teil A): project_id als Default-Zuordnung fürs ganze Dokument
 * (Rechnung/Beleg/Angebot/Auftrag) - eine Zeilen-eigene cost_center_id/
 * cost_object_id (siehe add_cost_dimensions_to_document_lines_table)
 * überschreibt diesen Default beim Buchen (Durchreich-Logik in
 * InvoiceBookingService/BelegController::book()).
 */
return new class extends Migration
{
    private const TABLES = ['invoices', 'belege', 'quotes', 'orders'];

    public function up(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignId('project_id')->nullable()->after('contact_id')
                    ->constrained('projects')->nullOnDelete();
                $table->index('project_id');
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropConstrainedForeignId('project_id');
            });
        }
    }
};
