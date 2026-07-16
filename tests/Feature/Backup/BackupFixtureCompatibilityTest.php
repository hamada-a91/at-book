<?php

namespace Tests\Feature\Backup;

use App\Models\Invoice;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\JournalEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Support\BackupTestHelper;
use Tests\TestCase;

/**
 * Kompatibilitätsvertrag mit alten Kundenbackups (SPEC-02, Abschnitt 2.1).
 *
 * tests/Fixtures/backup-v1.0-referenz.json ist eine EINGEFRORENE Kopie eines
 * echten Exports (erzeugt aus TenantTestDataFactory über
 * BackupRoundtripTest::test_generate_reference_fixture). Diese Datei wird
 * NIE automatisch neu erzeugt und ändert sich nur, wenn bewusst ein neuer
 * Kompatibilitäts-Snapshot gewollt ist. Sie muss auf Dauer importierbar
 * bleiben - das ist der Vertrag mit Kunden, die alte Backups einspielen.
 */
class BackupFixtureCompatibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_reference_fixture_is_importable_into_fresh_tenant(): void
    {
        $fixturePath = base_path('tests/Fixtures/backup-v1.0-referenz.json');
        $this->assertFileExists($fixturePath, 'Referenz-Fixture fehlt - siehe docs/specs/SPEC-02, Abschnitt 2.1.');

        $export = json_decode(file_get_contents($fixturePath), true);
        $this->assertIsArray($export);
        $this->assertArrayHasKey('metadata', $export);
        $this->assertArrayHasKey('manifest', $export);
        $this->assertArrayHasKey('data', $export);
        $this->assertSame('1.0', $export['metadata']['backup_version']);

        $zipPath = BackupTestHelper::buildZip($export);

        $tenant = Tenant::create(['name' => 'Fixture-Import Ziel-Tenant', 'slug' => 'fixture-import-'.uniqid()]);
        $user = User::create([
            'name' => 'Fixture Importeur',
            'email' => 'fixture-importeur-'.uniqid().'@at-book.test',
            'password' => Hash::make('password'),
            'tenant_id' => $tenant->id,
        ]);

        app()->instance('currentTenant', $tenant);

        $job = BackupTestHelper::importZip($zipPath, $tenant, $user);

        $this->assertSame(\App\Models\BackupJob::STATUS_COMPLETED, $job->status, $job->error_message ?? 'Import sollte erfolgreich sein.');

        // Stichprobe: die im Export enthaltene Rechnung muss unter dem neuen Tenant existieren.
        $invoiceRow = $export['data']['invoices'][0] ?? null;
        $this->assertNotNull($invoiceRow, 'Fixture sollte mindestens eine Rechnung enthalten.');

        $invoice = Invoice::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('invoice_number', $invoiceRow['invoice_number'])
            ->first();
        $this->assertNotNull($invoice, 'Rechnung aus der Referenz-Fixture muss nach Import auffindbar sein.');

        // total in der Fixture ist ein Dezimal-String, der den rohen Integer-Wert
        // (Cents) formatiert (siehe BaseTransformer::formatDecimal - KEINE
        // Cents->Euro-Umrechnung), z.B. "137900.00" für 137900 Cent.
        $this->assertSame((int) round((float) $invoiceRow['total']), $invoice->total);

        $journalCount = JournalEntry::withoutGlobalScopes()->where('tenant_id', $tenant->id)->count();
        $this->assertSame(count($export['data']['journal_entries'] ?? []), $journalCount);
    }
}
