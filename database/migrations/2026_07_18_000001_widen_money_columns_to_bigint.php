<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC-07 (7.1, behebt 08/Punkt 11): Betragsspalten (Cents) vereinheitlichen
 * auf `bigint` (max. integer ~21,4 Mio. EUR war zu knapp für größere
 * Rechnungen/Belege).
 *
 * IST-Analyse (per information_schema.columns geprüft, siehe Abschlussbericht):
 * - invoices.{subtotal,tax_total,total} = integer      -> bigint
 * - invoice_lines.{unit_price,line_total} = integer    -> bigint
 * - quotes.{subtotal,tax_total,total} = integer        -> bigint
 * - quote_lines.{unit_price,line_total} = integer      -> bigint
 * - orders.{subtotal,tax_total,total} = integer        -> bigint
 * - order_lines.{unit_price,line_total} = integer      -> bigint
 * - delivery_note_lines: hat KEINE Betragsspalten (nur quantity/unit) -> nichts zu tun
 * - belege.{amount,tax_amount} = bigint bereits (Migration
 *   2026_01_03_130000_create_beleg_lines_table-Umfeld) -> nur verifiziert, nicht geändert
 * - journal_entry_lines.{amount,tax_amount} = bigint bereits -> nur verifiziert, nicht geändert
 *
 * Postgres: ALTER COLUMN TYPE bigint ist eine verlustfreie Aufwärtskonvertierung
 * (kein Datenverlust, kein Tabellen-Rewrite-Risiko wie bei einer Verkleinerung).
 * Backup-Impact: JSON kennt nur Zahlen, Export/Import bleiben unverändert
 * (siehe docs/specs/SPEC-07-db-haertung.md, Backup-Impact Punkt 1).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->bigInteger('subtotal')->change();
            $table->bigInteger('tax_total')->change();
            $table->bigInteger('total')->change();
        });

        Schema::table('invoice_lines', function (Blueprint $table) {
            $table->bigInteger('unit_price')->change();
            $table->bigInteger('line_total')->change();
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->bigInteger('subtotal')->change();
            $table->bigInteger('tax_total')->change();
            $table->bigInteger('total')->change();
        });

        Schema::table('quote_lines', function (Blueprint $table) {
            $table->bigInteger('unit_price')->change();
            $table->bigInteger('line_total')->change();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->bigInteger('subtotal')->change();
            $table->bigInteger('tax_total')->change();
            $table->bigInteger('total')->change();
        });

        Schema::table('order_lines', function (Blueprint $table) {
            $table->bigInteger('unit_price')->change();
            $table->bigInteger('line_total')->change();
        });
    }

    public function down(): void
    {
        // Rückbau nur für lokale Entwicklung gedacht - ein Rollback nach
        // produktivem Einsatz mit Beträgen > 2^31 Cents würde Daten
        // beschädigen (out of range). Absichtlich keine Sonderbehandlung,
        // analog zu den übrigen ->change()-Migrationen in diesem Projekt.
        Schema::table('invoices', function (Blueprint $table) {
            $table->integer('subtotal')->change();
            $table->integer('tax_total')->change();
            $table->integer('total')->change();
        });

        Schema::table('invoice_lines', function (Blueprint $table) {
            $table->integer('unit_price')->change();
            $table->integer('line_total')->change();
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->integer('subtotal')->change();
            $table->integer('tax_total')->change();
            $table->integer('total')->change();
        });

        Schema::table('quote_lines', function (Blueprint $table) {
            $table->integer('unit_price')->change();
            $table->integer('line_total')->change();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->integer('subtotal')->change();
            $table->integer('tax_total')->change();
            $table->integer('total')->change();
        });

        Schema::table('order_lines', function (Blueprint $table) {
            $table->integer('unit_price')->change();
            $table->integer('line_total')->change();
        });
    }
};
