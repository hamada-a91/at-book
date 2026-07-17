<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC-06 (Audit-Log aktivieren): erweitert die bislang existierende, aber
 * nirgends befüllte `audit_logs`-Tabelle (2025_11_24_000003) auf das im Spec
 * beschriebene Schema.
 *
 * Rename statt Zusatzspalten: Die Tabelle wird bislang von KEINEM Code-Pfad
 * beschrieben (grep bestätigt: nur der auskommentierte Verweis in
 * BookingService) und hat keinen Backup-Transformer - es gibt also keine im
 * Umlauf befindlichen Kunden-Backups, die die alten Spaltennamen
 * (action/entity_type/entity_id) enthalten. Die Backup-Schutzregel
 * "Spalten nie umbenennen" (docs/specs/README.md, Regel 3) gilt explizit nur
 * "solange Backups im Umlauf sind, die sie enthalten" - das Rename auf die
 * Spec-Namen (event/auditable_type/auditable_id) ist daher sauberer als zwei
 * Spaltensätze parallel zu pflegen.
 *
 * Alle NEUEN Spalten sind nullable (CLAUDE.md-Regel: keine NOT-NULL-Spalten
 * ohne Default per Migration auf bestehende Tabellen).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            // CLAUDE.md-Regel 2: Tenant-Model braucht tenant_id (FK, mit Index).
            // Nullable, weil User-Events ohne Tenant-Kontext (Plattform-Admin
            // legt/blockt einen User ohne eigenen Tenant, siehe
            // 2026_01_17_134913_make_tenant_id_nullable_in_users_table) die
            // einzige erlaubte Ausnahme sind (siehe AuditLog::record()).
            $table->foreignId('tenant_id')->nullable()->after('id')->constrained()->cascadeOnDelete();

            // CLAUDE.md-Regel 2: HasPublicId-Pattern wie bei jedem anderen
            // Tenant-Model (u.a. Voraussetzung für einen künftigen
            // Backup-Transformer, der Beziehungen über public_id exportiert).
            $table->uuid('public_id')->nullable()->after('tenant_id');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->renameColumn('action', 'event');
            $table->renameColumn('entity_type', 'auditable_type');
            $table->renameColumn('entity_id', 'auditable_id');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            // War unsignedBigInteger NOT NULL - beim Backup-Import muss ein
            // Audit-Eintrag erhalten bleiben, auch wenn sein auditable-Ziel
            // im Zieltenant nicht mehr auffindbar ist (z.B. hart gelöscht) -
            // dann wird auditable_id explizit null gesetzt statt den
            // gesamten Eintrag zu verwerfen (siehe SPEC-06, Punkt 5 /
            // AuditLogTransformer).
            $table->unsignedBigInteger('auditable_id')->nullable()->change();

            // Kurzname der Ziel-Entity + öffentliche ID - für das
            // Backup-Remapping (siehe AuditLogTransformer) und als robuste
            // Referenz, falls die numerische ID sich beim Import ändert.
            $table->uuid('auditable_public_id')->nullable()->after('auditable_id');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->unique('public_id');
            // tenant_id ist Leitspalte des Composite-Index -> deckt auch
            // reine "WHERE tenant_id = ?"-Abfragen (z.B. das GoBD-Filtern im
            // Endpoint) mit ab, kein separater Einzel-Index nötig.
            $table->index(['tenant_id', 'auditable_type', 'auditable_id'], 'audit_logs_tenant_auditable_idx');
            $table->index(['tenant_id', 'created_at'], 'audit_logs_tenant_created_idx');
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('audit_logs_tenant_auditable_idx');
            $table->dropIndex('audit_logs_tenant_created_idx');
            $table->dropUnique(['public_id']);
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropColumn('auditable_public_id');
            $table->unsignedBigInteger('auditable_id')->nullable(false)->change();
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->renameColumn('event', 'action');
            $table->renameColumn('auditable_type', 'entity_type');
            $table->renameColumn('auditable_id', 'entity_id');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropColumn('public_id');
            $table->dropConstrainedForeignId('tenant_id');
        });
    }
};
