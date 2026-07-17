<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * SPEC-04 (4.1 Schema-Check): tax_codes.account_id existiert bereits seit
 * 2025_12_07_000003_create_tax_codes_table.php - KEINE Schema-Änderung nötig,
 * daher auch kein TaxCodeTransformer-Update erforderlich (Backup-Schutzregel 2
 * greift nur bei neuen/geänderten Spalten).
 *
 * Reine Datenmigration: Neu angelegte Tenants bekommen ihre Steuerschlüssel
 * bereits mit Konto-Zuordnung (AccountPlanController::generate()). Bestands-
 * Tenants, deren tax_codes-Einträge vor dieser Zuordnung entstanden sind (oder
 * bei denen das passende Konto zum Zeitpunkt der Anlage noch fehlte), bekommen
 * hier pro Tenant die SKR03-Standardzuordnung nachgetragen: 19% -> Konto 1776,
 * 7% -> Konto 1771 - nur wenn account_id noch NULL ist und das Konto existiert.
 * Bestehende, bereits gesetzte Zuordnungen werden nicht angetastet.
 */
return new class extends Migration
{
    private const RATE_TO_ACCOUNT_CODE = [
        19.00 => '1776',
        7.00 => '1771',
    ];

    public function up(): void
    {
        foreach (self::RATE_TO_ACCOUNT_CODE as $rate => $accountCode) {
            DB::statement(
                'UPDATE tax_codes
                 SET account_id = accounts.id
                 FROM accounts
                 WHERE tax_codes.tenant_id = accounts.tenant_id
                   AND accounts.code = ?
                   AND tax_codes.type = ?
                   AND tax_codes.rate = ?
                   AND tax_codes.account_id IS NULL',
                [$accountCode, 'output_tax', $rate]
            );
        }
    }

    public function down(): void
    {
        // Reine Datenmigration (kein Schema-Wechsel) - kein Rollback, um zwischenzeitlich
        // manuell gepflegte Zuordnungen nicht zu zerstören.
    }
};
