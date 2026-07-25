<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC-07 (7.2, behebt 08/Punkt 13): tenant_id-Indizes für Tabellen, deren
 * tenant_id bislang un-indiziert ist. PostgreSQL indiziert Fremdschlüssel
 * NICHT automatisch - jede über den BelongsToTenant-Global-Scope gescopte
 * Query auf diesen Tabellen war bislang ein Seq-Scan.
 *
 * IST-Analyse (per `pg_indexes` erhoben, siehe Abschlussbericht für die
 * vollständige Liste):
 *
 * Bereits abgedeckt (composite UNIQUE/INDEX mit tenant_id als Leitspalte
 * zählt gemäß Spec-Prinzip "Composite-Uniques zählen als Index" als
 * ausreichend - ein zusätzlicher reiner index('tenant_id') wäre ein
 * redundanter Duplikat-Index, siehe harte Regel "keine Duplikat-Indizes"):
 * - accounts            unique(tenant_id, code)
 * - tax_codes           unique(tenant_id, code)
 * - invoices            unique(tenant_id, invoice_number)   [zusätzlich unten (tenant_id,status)]
 * - quotes              unique(tenant_id, quote_number)
 * - orders              unique(tenant_id, order_number)
 * - delivery_notes      unique(tenant_id, delivery_note_number)
 * - belege              unique(tenant_id, document_number)  [zusätzlich unten (tenant_id,status)]
 * - journal_entries     unique(tenant_id, journal_number)   [zusätzlich unten (tenant_id,booking_date)]
 * - number_sequences    unique(tenant_id, type, year) UND bereits expliziter index(tenant_id)
 * - backup_jobs         index(tenant_id, type, status)
 * - audit_logs          index(tenant_id, auditable_type, auditable_id) + index(tenant_id, created_at) (SPEC-06)
 *
 * Fehlten komplett (kein Index mit tenant_id als Leitspalte) -> werden unten
 * ergänzt: contacts, bank_accounts, company_settings, products,
 * product_categories, inventory_transactions, bug_reports, users.
 *
 * Zusätzliche Composite-Indizes gemäß Spec (Query-Pattern "WHERE tenant_id = ?
 * AND status = ?" bzw. "... ORDER BY booking_date"):
 * - journal_entries(tenant_id, booking_date)
 * - invoices(tenant_id, status)
 * - belege(tenant_id, status)
 *
 * Alle Änderungen sind additiv (nur neue Indizes) - kein Backup-Einfluss.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->addIndexIfMissing('journal_entries', ['tenant_id', 'booking_date']);
        $this->addIndexIfMissing('invoices', ['tenant_id', 'status']);
        $this->addIndexIfMissing('belege', ['tenant_id', 'status']);

        foreach ([
            'contacts',
            'bank_accounts',
            'company_settings',
            'products',
            'product_categories',
            'inventory_transactions',
            'bug_reports',
            'users',
        ] as $table) {
            $this->addIndexIfMissing($table, ['tenant_id']);
        }
    }

    public function down(): void
    {
        $this->dropIndexIfExists('journal_entries', ['tenant_id', 'booking_date']);
        $this->dropIndexIfExists('invoices', ['tenant_id', 'status']);
        $this->dropIndexIfExists('belege', ['tenant_id', 'status']);

        foreach ([
            'contacts',
            'bank_accounts',
            'company_settings',
            'products',
            'product_categories',
            'inventory_transactions',
            'bug_reports',
            'users',
        ] as $table) {
            $this->dropIndexIfExists($table, ['tenant_id']);
        }
    }

    /**
     * @param  list<string>  $columns
     */
    private function addIndexIfMissing(string $table, array $columns): void
    {
        if (Schema::hasIndex($table, $columns)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($columns) {
            $blueprint->index($columns);
        });
    }

    /**
     * @param  list<string>  $columns
     */
    private function dropIndexIfExists(string $table, array $columns): void
    {
        if (! Schema::hasIndex($table, $columns)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($columns) {
            $blueprint->dropIndex($columns);
        });
    }
};
