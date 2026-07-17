<?php

namespace Tests\Feature\Backup;

use App\Models\CompanySetting;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Invoice;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Contacts\Models\Contact;
use App\Services\Backup\Transformers\EntityTransformerRegistry;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tests\Support\BackupTestHelper;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

/**
 * Backup-Roundtrip-Regressionstest (SPEC-02, Abschnitt 2.1).
 *
 * Dies ist der automatische Wächter für app/Services/Backup/: Export von
 * Tenant A -> Import in frischen Tenant B -> Zähler/Stichproben müssen
 * übereinstimmen. Schlägt automatisch fehl, wenn ein neues
 * BelongsToTenant-Model ohne Backup-Transformer eingeführt wird (siehe
 * test_registry_covers_all_belongs_to_tenant_models).
 *
 * WICHTIG: Ändert NICHTS an app/Services/Backup/ – reine Blackbox-Tests
 * gegen die öffentliche Service-API.
 */
class BackupRoundtripTest extends TestCase
{
    use RefreshDatabase;

    /**
     * KRITISCHER BUG (drittes Fundstück in diesem Test, siehe Abschlussbericht
     * SPEC-02): BackupImportService::importEntityType() ruft
     * $modelClass::unguard() vor dem Insert und $modelClass::reguard() danach
     * auf - OHNE try/finally. Wirft der Insert eine Exception (z.B. genau der
     * beleg_lines-Bug oben), wird reguard() NIE erreicht. Da Model::$unguarded
     * eine GLOBALE static Property auf der Basis-Klasse
     * Illuminate\Database\Eloquent\Model ist (nicht pro Modell), bleibt die
     * Mass-Assignment-Protection für ALLE Eloquent-Models im restlichen
     * PHP-Prozess deaktiviert - u.a. beobachtet als Cross-Test-Pollution:
     * Contact::create() nahm plötzlich nicht-fillable Felder wie 'account_code'
     * an, wenn die Test-Suite in einem Lauf nach diesem Test ausgeführt wurde.
     * In einem echten PHP-FPM-Worker würde ein fehlgeschlagener Import also
     * die Mass-Assignment-Absicherung für ALLE nachfolgenden Requests dieses
     * Workers aufheben - ein Sicherheitsrisiko. Da app/Services/Backup/ hier
     * nicht geändert werden darf, wird der Zustand defensiv nach jedem Test
     * zurückgesetzt, damit dieser Test keine anderen Tests kontaminiert.
     */
    protected function tearDown(): void
    {
        \Illuminate\Database\Eloquent\Model::reguard();
        parent::tearDown();
    }

    /**
     * Registry-Ausnahmen: BelongsToTenant-Models, die BEWUSST keinen
     * Backup-Transformer haben.
     *
     * - BackupJob / BackupAuditLog: Meta-Daten ÜBER Backup-Vorgänge selbst
     *   (wer hat wann ex-/importiert, Fortschritt, Fehler). Sie beschreiben
     *   den Backup-Prozess, sind aber keine Geschäftsdaten des Mandanten.
     *   Sie in einem Backup mitzuführen wäre zirkulär (ein Import würde
     *   Log-Einträge über vergangene, ggf. andere Exporte erzeugen) und ihr
     *   Verlust beim Restore ist unkritisch (Audit-Historie des
     *   Backup-Moduls selbst, keine Buchhaltungsdaten). Siehe auch den
     *   Kommentar "documents excluded" in EntityTransformerRegistry für ein
     *   analoges, dort bereits vom Projekt getroffenes Beispiel.
     * - NumberSequence (SPEC-05, Teil A): bewusst NICHT exportiert/importiert
     *   (siehe docs/specs/SPEC-05-nummernkreise.md, Backup-Impact Punkt 1).
     *   Ein Export/Import der Sequenz-Tabelle selbst wäre fragil - u.a. bei
     *   alten Backups (Tabelle existierte noch nicht) oder manuell
     *   manipulierten last_number-Werten. Stattdessen rekonstruiert
     *   BackupImportService::reconstructNumberSequences() last_number je
     *   Typ/Jahr NACH dem Import direkt aus den tatsächlich importierten
     *   Dokument-/Journalnummern (robuster, kann nicht aus dem Tritt geraten).
     *   Test: tests/Feature/Backup/NumberSequenceReconstructionTest.php.
     */
    private const REGISTRY_EXCEPTIONS = [
        \App\Models\BackupJob::class,
        \App\Models\BackupAuditLog::class,
        \App\Models\NumberSequence::class,
    ];

    /**
     * Vollständigkeits-Check: JEDES Model mit BelongsToTenant-Trait muss
     * einen Eintrag in der EntityTransformerRegistry haben (Ausnahme: siehe
     * REGISTRY_EXCEPTIONS oben). So schlägt der Test automatisch fehl, wenn
     * eine neue Tenant-Entity ohne Backup-Transformer eingeführt wird –
     * genau der Schutzmechanismus, den die Backup-Schutzregeln in
     * docs/specs/README.md verlangen.
     */
    public function test_registry_covers_all_belongs_to_tenant_models(): void
    {
        $tenantScopedModels = $this->discoverBelongsToTenantModels();
        $this->assertNotEmpty($tenantScopedModels, 'Model-Scan darf nicht leer sein - sonst wäre der Test ein Blindgänger.');

        $registry = new EntityTransformerRegistry;
        $registeredModelClasses = [];
        foreach ($registry->getEntityTypes() as $entityType) {
            $transformer = $registry->getTransformer($entityType);
            if ($transformer) {
                $registeredModelClasses[] = $transformer->getModelClass();
            }
        }

        $missing = [];
        foreach ($tenantScopedModels as $modelClass) {
            if (in_array($modelClass, self::REGISTRY_EXCEPTIONS, true)) {
                continue;
            }
            if (! in_array($modelClass, $registeredModelClasses, true)) {
                $missing[] = $modelClass;
            }
        }

        $this->assertEmpty(
            $missing,
            "Diese BelongsToTenant-Models haben KEINEN Backup-Transformer registriert (Datenverlust beim Restore!): \n"
            .implode("\n", $missing)
            ."\n\nEntweder Transformer + Registry-Eintrag nachrüsten (siehe docs/specs/README.md, Backup-Schutzregeln Punkt 1) oder bewusst in REGISTRY_EXCEPTIONS aufnehmen und begründen."
        );
    }

    public function test_roundtrip_preserves_entity_counts_and_relations(): void
    {
        // ---- Arrange: Tenant A mit realistischem Datenbestand ----
        $dataA = TenantTestDataFactory::create('rtA');
        $tenantA = $dataA->tenant;
        $userA = $dataA->user;

        // KRITISCHER BEKANNTER BUG (siehe test_known_bug_beleg_line_with_price_breaks_import
        // unten für die minimale Reproduktion): BelegLineTransformer exportiert
        // unit_price/line_total als Dezimal-String ("15000.00"), aber
        // BackupImportService::prepareForInsert() fehlt 'beleg_lines' in der
        // $moneyFields-Whitelist (im Gegensatz zu invoice_lines/quote_lines/
        // order_lines/delivery_note_lines, die dort korrekt gelistet sind).
        // Postgres lehnt den String für die integer-Spalte ab, die Transaktion
        // wird "aborted" und JEDER nachfolgende Insert (inkl. journal_entries!)
        // schlägt fehl -> der GESAMTE Import bricht ab, sobald irgendeine
        // BelegLine existiert. Das betrifft jeden echten Tenant mit Belegen,
        // die Positionszeilen haben, und ist damit ein Datenverlust-Risiko beim
        // Restore. Gemäß Hard-Rule "keine Änderungen an app/Services/Backup/"
        // wird das hier NICHT gefixt. Damit der Rest des Roundtrips (alle
        // anderen 20 Entity-Typen) trotzdem sinnvoll geprüft werden kann, wird
        // die Beleg-Zeile vor dem Export entfernt. Die Lücke selbst bleibt über
        // test_known_bug_beleg_line_with_price_breaks_import abgesichert.
        $dataA->beleg->lines()->delete();

        // SPEC-05 (Teil B): books_locked_until VOR dem Export setzen, um zu prüfen,
        // dass die Periodensperre den Roundtrip überlebt (CompanySettingTransformer).
        $dataA->companySetting->update(['books_locked_until' => now()->subDays(20)->toDateString()]);

        // Counts VOR dem Export einfrieren, um später "Tenant A unverändert" zu prüfen.
        $countsBeforeA = $this->tenantModelCounts($tenantA->id);

        // ---- Act: Export von Tenant A ----
        $exportA = BackupTestHelper::exportToArray($tenantA, $userA);

        // ---- Arrange: frischer, leerer Tenant B ----
        $tenantB = Tenant::create(['name' => 'Roundtrip Ziel-Tenant', 'slug' => 'roundtrip-ziel-'.uniqid()]);
        $userB = User::create([
            'name' => 'Roundtrip Importeur',
            'email' => 'importeur-'.uniqid().'@at-book.test',
            'password' => Hash::make('password'),
            'tenant_id' => $tenantB->id,
        ]);

        // ---- Act: Import in Tenant B ----
        app()->instance('currentTenant', $tenantB);
        Auth::setUser($userB);
        BackupTestHelper::importZip($exportA['zip_path'], $tenantB, $userB);

        // ---- Act: erneuter Export von Tenant B, um den Ist-Zustand
        // unabhängig von den (internen) Import-Statistiken zu verifizieren ----
        $exportB = BackupTestHelper::exportToArray($tenantB, $userB);

        // ---- Assert (i): Zähler pro Entity-Typ aus der Registry identisch A vs. B ----
        //
        // KRITISCHER BEKANNTER BUG (siehe minimale Reproduktion in
        // test_known_bug_line_transformers_leak_across_tenants unten):
        // quote_lines, order_lines, delivery_note_lines, invoice_lines und
        // beleg_lines haben KEINE tenant_id-Spalte (bewusst, sie hängen am
        // Parent). BaseTransformer::getQuery() filtert nur, wenn die Tabelle
        // eine tenant_id-Spalte hat (Schema::hasColumn-Check) - für diese 5
        // "Line"-Typen fehlt daher JEDER Tenant-Filter beim Export, außer bei
        // JournalEntryLineTransformer, der als einziger Line-Transformer einen
        // eigenen getQuery()-Override mit whereHas('journalEntry', tenant_id)
        // hat. Das heißt: Ein Export für Tenant B enthält AUSNAHMSLOS ALLE
        // Zeilen dieser 5 Typen aus der GESAMTEN Datenbank, nicht nur die
        // eigenen - ein Cross-Tenant-Datenleck von Finanzdaten (Positionen,
        // Preise) über Mandantengrenzen hinweg. In diesem Test wird das
        // konkret sichtbar, weil nach dem Import in Tenant B sowohl A's als
        // auch B's Zeilen im DB-weiten Bestand liegen und der zweite Export
        // (von B) beide einsammelt (A=2, B=4 bei quote_lines z.B.).
        //
        // Gemäß Hard-Rule "keine Änderungen an app/Services/Backup/" wird das
        // hier NICHT gefixt. Für diese 5 Typen wird die Zähler-Gleichheit
        // daher bewusst NICHT geprüft (sie WÜRDE bei jedem Lauf mit >1 Tenant
        // in der DB fehlschlagen - das ist erwartetes, dokumentiertes
        // Verhalten des Bugs, kein Test-Flake). Die Line-Typen werden
        // stattdessen unten gezielt per public_id-Stichprobe geprüft.
        $knownCrossTenantLeakTypes = ['quote_lines', 'order_lines', 'delivery_note_lines', 'invoice_lines', 'beleg_lines'];

        // SPEC-06: audit_logs ist bewusst KEIN 1:1-Zähler-Vergleich - der Import
        // selbst schreibt einen zusätzlichen 'imported'-Eintrag an
        // Tenant B's CompanySetting (siehe BackupImportService::processImport()),
        // der im zweiten Export (von B) mitgezählt wird. B hat daher IMMER genau
        // einen audit_logs-Eintrag mehr als A - das wird unten gezielt geprüft.
        $countMismatchByDesign = [...$knownCrossTenantLeakTypes, 'audit_logs'];

        $registry = new EntityTransformerRegistry;
        foreach ($registry->getEntityTypes() as $entityType) {
            if (in_array($entityType, $countMismatchByDesign, true)) {
                continue;
            }

            $countA = $this->manifestCount($exportA['manifest'], $entityType);
            $countB = $this->manifestCount($exportB['manifest'], $entityType);

            $this->assertSame(
                $countA,
                $countB,
                "Entity-Typ '{$entityType}': Anzahl nach Roundtrip unterschiedlich (A={$countA}, B={$countB})."
            );
        }

        // Sanity: Der Datenbestand ist nicht leer (sonst wäre der Vergleich trivial).
        $this->assertGreaterThan(0, $exportA['manifest']['total_entities']);

        // SPEC-06: audit_logs-Zähler - A's komplette Historie muss den Roundtrip
        // überleben (+1 für den 'imported'-Eintrag, den der Import selbst erzeugt).
        $auditCountA = $this->manifestCount($exportA['manifest'], 'audit_logs');
        $auditCountB = $this->manifestCount($exportB['manifest'], 'audit_logs');
        $this->assertGreaterThan(0, $auditCountA, 'Sanity: Tenant A muss über TenantTestDataFactory bereits Audit-Einträge (created/locked/reversed/...) angesammelt haben.');
        $this->assertSame($auditCountA + 1, $auditCountB, 'audit_logs: B muss exakt A + den einen imported-Eintrag aus dem Restore selbst enthalten.');

        // SPEC-06: Stichprobe Remapping - ein 'locked'-Audit-Eintrag zur
        // festgeschriebenen Buchung (journalPosted) muss in B über die
        // auditable-Referenz (auditable_type_short/auditable_public_id im
        // Backup -> auditable_type/auditable_id nach dem Import) auf die
        // KORREKT remappte JournalEntry in Tenant B zeigen, nicht auf die
        // (nicht mehr existierende) numerische ID aus Tenant A.
        $lockedAuditRowsA = array_values(array_filter(
            $exportA['data']['audit_logs'] ?? [],
            fn (array $row) => $row['event'] === 'locked' && $row['auditable_type_short'] === 'journal_entry'
        ));
        $this->assertNotEmpty($lockedAuditRowsA, 'Sanity: Tenant A muss mindestens einen locked-Audit-Eintrag für eine JournalEntry haben.');

        // invoice_lines: gezielte Stichprobe statt Zähler-Vergleich (s.o.) - über
        // die stabile invoice_number (s.u.) finden wir B's Zeilen und vergleichen
        // Summen/Beträge gegen die Originalzeilen von A.
        //
        // ---- Assert (iv): Tenant A wurde durch Export+Import(B) NICHT verändert ----
        $countsAfterA = $this->tenantModelCounts($tenantA->id);
        $this->assertSame($countsBeforeA, $countsAfterA, 'Tenant A darf durch den Export/Import-Vorgang für Tenant B nicht verändert werden.');

        // ---- Assert (iii): Stichproben - Beträge/Status/locked_at + Beziehungen ----
        //
        // WICHTIG zu public_id: Ein Import von Tenant A's Backup in einen ANDEREN
        // Tenant B ist per Definition ein "Cross-Tenant-Import" (metadata.tenant_public_id
        // von A != tenant->public_id von B). BackupImportService generiert in diesem
        // Fall bewusst NEUE public_ids für alle importierten Datensätze (Kommentar im
        // Code: "avoids unique constraint violations"). Das ist korrektes, gewolltes
        // Verhalten - public_ids sind pro Tenant eindeutig, nicht global. Die
        // "Verknüpfung via public_id"-Prüfung aus der Spec bezieht sich daher auf den
        // INTERNEN Remapping-Mechanismus (ImportIdMapping: alte public_id -> neue
        // interne ID), den wir hier als Black-Box über stabile Geschäftsschlüssel
        // (Rechnungsnummer, Kontocode, E-Mail) verifizieren: Zeigt die FK in B korrekt
        // auf die semantisch richtige Zeile?
        app()->instance('currentTenant', $tenantB);

        $invoiceB = Invoice::withoutGlobalScopes()
            ->where('tenant_id', $tenantB->id)
            ->where('invoice_number', $dataA->invoice->invoice_number)
            ->first();
        $this->assertNotNull($invoiceB, 'Rechnung aus Tenant A muss (über die Rechnungsnummer identifizierbar) in Tenant B wieder auftauchen.');
        $this->assertNotSame($dataA->invoice->public_id, $invoiceB->public_id, 'Cross-Tenant-Import muss eine NEUE public_id vergeben (siehe Kommentar oben).');
        $this->assertSame($dataA->invoice->subtotal, $invoiceB->subtotal);
        $this->assertSame($dataA->invoice->tax_total, $invoiceB->tax_total);
        $this->assertSame($dataA->invoice->total, $invoiceB->total);
        $this->assertSame($dataA->invoice->status, $invoiceB->status);

        foreach ($dataA->invoice->lines as $originalLine) {
            $importedLine = $invoiceB->lines()->where('description', $originalLine->description)->first();
            $this->assertNotNull($importedLine, "invoice_line '{$originalLine->description}' muss unter der importierten Rechnung wiederauftauchen.");
            $this->assertSame($originalLine->line_total, $importedLine->line_total);
            $this->assertSame($originalLine->unit_price, $importedLine->unit_price);
        }

        // Rechnung -> Kontakt-Verknüpfung korrekt neu gemappt (stabiler Schlüssel: E-Mail)
        $contactB = Contact::withoutGlobalScopes()->where('id', $invoiceB->contact_id)->first();
        $this->assertNotNull($contactB);
        $this->assertSame($dataA->customer->email, $contactB->email, 'Invoice->Contact muss auf den korrekt remappten Kontakt zeigen.');
        $this->assertNotSame($dataA->customer->id, $contactB->id, 'Tenant B muss eigene numerische IDs bekommen (kein ID-Reuse über Tenants hinweg).');

        // Festgeschriebene Buchung: locked_at (GoBD) muss erhalten bleiben.
        // Identifikation über booking_date+description, da public_id sich beim
        // Cross-Tenant-Import ändert (s.o.) und JournalEntry keine weitere stabile
        // Business-ID hat.
        $journalPostedB = JournalEntry::withoutGlobalScopes()
            ->where('tenant_id', $tenantB->id)
            ->where('description', $dataA->journalPosted->description)
            ->whereDate('booking_date', $dataA->journalPosted->booking_date)
            ->first();
        $this->assertNotNull($journalPostedB);
        $this->assertNotSame($dataA->journalPosted->public_id, $journalPostedB->public_id);
        $this->assertNotNull($journalPostedB->locked_at, 'locked_at (GoBD-Festschreibung) muss den Roundtrip überleben.');

        // SPEC-06: Stichprobe Remapping - der 'locked'-Audit-Eintrag zu
        // journalPosted muss in B über auditable_type/auditable_id auf GENAU
        // die oben identifizierte, korrekt remappte JournalEntry zeigen (nicht
        // auf die alte, in B nicht mehr existierende ID aus Tenant A).
        $lockedAuditB = \App\Modules\Accounting\Models\AuditLog::withoutGlobalScopes()
            ->where('tenant_id', $tenantB->id)
            ->where('event', 'locked')
            ->where('auditable_type', JournalEntry::class)
            ->where('auditable_id', $journalPostedB->id)
            ->first();
        $this->assertNotNull($lockedAuditB, "Audit-Eintrag 'locked' muss nach dem Import auf die remappte JournalEntry in Tenant B zeigen.");
        $this->assertSame($journalPostedB->public_id, $lockedAuditB->auditable_public_id, 'auditable_public_id muss nach dem Remapping auf B\'s NEUE public_id zeigen.');
        $this->assertSame('posted', $lockedAuditB->new_values['status'] ?? null, 'new_values muss den Roundtrip inhaltlich überleben (JSON alt/neu-Werte).');

        // SPEC-05 (Teil A): journal_number (seit lockBooking() vergeben) muss den
        // Roundtrip überleben (JournalEntryTransformer).
        $this->assertNotNull($dataA->journalPosted->journal_number, 'Sanity: lockBooking() muss journal_number vergeben haben.');
        $this->assertSame(
            $dataA->journalPosted->journal_number,
            $journalPostedB->journal_number,
            'SPEC-05: journal_number muss den Roundtrip überleben.'
        );

        // BEKANNTER BUG (siehe Abschlussbericht SPEC-02): JournalEntryTransformer
        // exportiert das Feld 'status' NICHT (siehe
        // app/Services/Backup/Transformers/JournalEntryTransformer.php::transform).
        // Nach dem Import landen daher ALLE Journalbuchungen auf dem Spalten-Default
        // 'draft' - unabhängig vom ursprünglichen Status (posted/cancelled). Gemäß
        // Hard-Rule "keine Änderungen an app/Services/Backup/" wird das hier NICHT
        // gefixt, sondern bewusst dokumentiert statt stillschweigend weggelassen.
        // GoBD-relevant ist ohnehin in erster Linie locked_at (oben geprüft), nicht
        // das status-Feld.
        $this->assertSame(
            'draft',
            $journalPostedB->status,
            'Dokumentiert bekannten Bug: status wird beim Backup-Roundtrip NICHT mitgenommen (siehe Kommentar). '
            .'Falls dieser Assert künftig fehlschlägt, wurde der Bug behoben - dann bitte auf assertSame("posted", ...) ändern.'
        );

        // Journalzeile -> Konto-Verknüpfung korrekt neu gemappt (stabiler Schlüssel: Kontocode)
        $lineB = $journalPostedB->lines()->first();
        $this->assertNotNull($lineB);
        $accountB = Account::withoutGlobalScopes()->where('id', $lineB->account_id)->first();
        $this->assertNotNull($accountB);
        $originalLine = $dataA->journalPosted->lines()->where('type', $lineB->type)->where('amount', $lineB->amount)->first();
        $this->assertNotNull($originalLine);
        $originalAccount = Account::withoutGlobalScopes()->find($originalLine->account_id);
        $this->assertSame($originalAccount->code, $accountB->code, 'JournalEntryLine->Account muss auf das korrekt remappte Konto (gleicher Kontocode) zeigen.');

        // Stornierte Buchung: Original bleibt 'cancelled' (Status wird zwar generell
        // nicht exportiert - s.o. -, hier zusätzlich zur Doku der Vollständigkeit halber).
        $journalCancelledB = JournalEntry::withoutGlobalScopes()
            ->where('tenant_id', $tenantB->id)
            ->where('description', $dataA->journalCancelled->description)
            ->whereDate('booking_date', $dataA->journalCancelled->booking_date)
            ->first();
        $this->assertNotNull($journalCancelledB);
        $this->assertNotNull($journalCancelledB->locked_at);

        // SPEC-05 (Teil B): books_locked_until muss den Roundtrip überleben
        // (CompanySettingTransformer).
        $companySettingB = CompanySetting::withoutGlobalScopes()->where('tenant_id', $tenantB->id)->first();
        $this->assertNotNull($companySettingB);
        $this->assertNotNull($companySettingB->books_locked_until, 'SPEC-05: books_locked_until muss den Roundtrip überleben.');
        $this->assertSame(
            $dataA->companySetting->fresh()->books_locked_until->toDateString(),
            Carbon::parse($companySettingB->books_locked_until)->toDateString()
        );
    }

    /**
     * KRITISCHER BUG - minimale Reproduktion: Line-Transformer ohne eigenen
     * getQuery()-Override (quote_lines, order_lines, delivery_note_lines,
     * invoice_lines, beleg_lines) filtern NICHT nach Tenant, weil
     * BaseTransformer::getQuery() nur filtert, wenn die Tabelle eine
     * tenant_id-Spalte hat - diese "Line"-Tabellen haben bewusst keine (sie
     * hängen am Parent). Ergebnis: Der Export eines Tenants enthält die
     * Positionszeilen ALLER Tenants der Instanz, nicht nur die eigenen -
     * ein Cross-Tenant-Datenleck (Artikel, Preise, Beschreibungen anderer
     * Mandanten landen im eigenen Backup).
     *
     * Fundstelle für den Fix (nicht Teil von SPEC-02, siehe Abschlussbericht):
     * jeweils app/Services/Backup/Transformers/{Quote,Order,DeliveryNote,Invoice,Beleg}LineTransformer.php
     * braucht (wie JournalEntryLineTransformer bereits vorgemacht) einen
     * getQuery()-Override mit whereHas($parent, fn($q) => $q->where('tenant_id', $tenant->id)).
     *
     * Dieser Test hält den Ist-Zustand bewusst als ROTEN Regressionsanker fest.
     */
    public function test_known_bug_line_transformers_leak_across_tenants(): void
    {
        $dataA = TenantTestDataFactory::create('leakA');
        $dataB = TenantTestDataFactory::create('leakB');

        // Export von Tenant B (dem "Opfer") - currentTenant/Auth zeigen nach der
        // zweiten Factory-Erstellung bereits auf B.
        $exportB = BackupTestHelper::exportToArray($dataB->tenant, $dataB->user);

        $quoteLineDescriptions = array_column($exportB['data']['quote_lines'] ?? [], 'description');

        $leakedDescription = $dataA->quote->lines()->first()->description;
        $this->assertContains(
            $leakedDescription,
            $quoteLineDescriptions,
            "Cross-Tenant-Leck bestätigt: Tenant B's Export enthält eine quote_line von Tenant A ('{$leakedDescription}')."
        );
    }

    /**
     * KRITISCHER BUG - minimale Reproduktion (siehe ausführlichen Kommentar in
     * test_roundtrip_preserves_entity_counts_and_relations): Sobald ein Beleg
     * eine Zeile mit unit_price/line_total hat (Normalfall!), bricht der
     * komplette Import ab, weil BackupImportService::prepareForInsert() die
     * Dezimal-Strings für 'beleg_lines' nicht zurück in Integer-Cents
     * konvertiert (fehlender Eintrag in der $moneyFields-Map, im Unterschied
     * zu invoice_lines/quote_lines/order_lines/delivery_note_lines).
     *
     * Dieser Test hält den Ist-Zustand bewusst als ROTEN Regressionsanker fest
     * (erwartet die Exception). Wird der Bug künftig im Backup-Modul gefixt,
     * schlägt DIESER Test fehl ("expected exception not thrown") - das ist
     * dann das Signal, ihn anzupassen (Assertion auf Erfolg drehen) und den
     * Workaround in test_roundtrip_preserves_entity_counts_and_relations
     * (das lines()->delete()) zu entfernen.
     *
     * Fundstelle für den Fix (nicht Teil von SPEC-02, siehe Abschlussbericht):
     * app/Services/Backup/BackupImportService.php, Methode prepareForInsert(),
     * Array $moneyFields -> 'beleg_lines' => ['unit_price', 'line_total']
     * ergänzen.
     */
    public function test_known_bug_beleg_line_with_price_breaks_import(): void
    {
        $dataA = TenantTestDataFactory::create('belegbug');

        // Beleg hat bereits eine Zeile mit unit_price=15000 aus der Factory.
        $this->assertNotNull($dataA->beleg->lines()->first());
        $this->assertGreaterThan(0, $dataA->beleg->lines()->first()->unit_price);

        $export = BackupTestHelper::exportToArray($dataA->tenant, $dataA->user);

        $tenantB = Tenant::create(['name' => 'Belegbug Ziel-Tenant', 'slug' => 'belegbug-ziel-'.uniqid()]);
        $userB = User::create([
            'name' => 'Belegbug Importeur',
            'email' => 'belegbug-'.uniqid().'@at-book.test',
            'password' => Hash::make('password'),
            'tenant_id' => $tenantB->id,
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Import fehlgeschlagen: Transaktion wurde durch einen vorherigen Fehler abgebrochen');

        BackupTestHelper::importZip($export['zip_path'], $tenantB, $userB);
    }

    /**
     * Erzeugt (einmalig, per Hand auszuführen) die eingefrorene Referenz-Fixture
     * tests/Fixtures/backup-v1.0-referenz.json aus einem frischen Export.
     *
     * Dieser Test ist standardmäßig übersprungen: er soll nur bewusst erneut
     * ausgeführt werden, wenn eine NEUE Referenz-Fixture gewünscht ist (z.B.
     * bewusste backup_version-Erhöhung). Der eigentliche Kompatibilitätsvertrag
     * wird von BackupFixtureCompatibilityTest geprüft, welcher die eingecheckte
     * Datei liest, OHNE sie neu zu erzeugen.
     */
    public function test_generate_reference_fixture(): void
    {
        if (! env('GENERATE_BACKUP_FIXTURE', false)) {
            $this->markTestSkipped('Nur zur manuellen Fixture-Erzeugung: GENERATE_BACKUP_FIXTURE=true sail artisan test --filter=test_generate_reference_fixture');
        }

        $data = TenantTestDataFactory::create('fixture');

        // Siehe test_known_bug_beleg_line_with_price_breaks_import: eine BelegLine
        // mit unit_price bricht den Import wegen eines bestehenden Bugs in
        // BackupImportService IMMER ab. Die Referenz-Fixture soll aber ein
        // gültiger, dauerhaft importierbarer Kompatibilitätsvertrag sein (das ist
        // ihr einziger Zweck - siehe BackupFixtureCompatibilityTest) und keine
        // zusätzliche Kopie des ohnehin schon dedizierten Bug-Tests. Deshalb wird
        // die Beleg-Zeile hier bewusst entfernt (der Beleg-Header selbst bleibt
        // Teil der Fixture).
        $data->beleg->lines()->delete();

        $export = BackupTestHelper::exportToArray($data->tenant, $data->user);

        unset($export['job'], $export['zip_path']);

        file_put_contents(
            base_path('tests/Fixtures/backup-v1.0-referenz.json'),
            json_encode($export, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );

        $this->assertFileExists(base_path('tests/Fixtures/backup-v1.0-referenz.json'));
    }

    /**
     * @return array<string, int>
     */
    private function tenantModelCounts(int $tenantId): array
    {
        return [
            'accounts' => Account::withoutGlobalScopes()->where('tenant_id', $tenantId)->count(),
            'contacts' => Contact::withoutGlobalScopes()->where('tenant_id', $tenantId)->count(),
            'invoices' => Invoice::withoutGlobalScopes()->where('tenant_id', $tenantId)->count(),
            'journal_entries' => JournalEntry::withoutGlobalScopes()->where('tenant_id', $tenantId)->count(),
        ];
    }

    private function manifestCount(array $manifest, string $entityType): int
    {
        foreach ($manifest['entities'] ?? [] as $entity) {
            if ($entity['type'] === $entityType) {
                return $entity['count'];
            }
        }

        return 0;
    }

    /**
     * Scannt app/Models und app/Modules/* /Models per Datei-Parsing (Namespace +
     * Klassenname) nach Models, die den BelongsToTenant-Trait nutzen
     * (class_uses_recursive, damit auch über Zwischen-Traits/-Klassen erkannt
     * wird).
     *
     * @return list<class-string>
     */
    private function discoverBelongsToTenantModels(): array
    {
        $directories = array_merge(
            [app_path('Models')],
            glob(app_path('Modules').'/*/Models', GLOB_ONLYDIR) ?: []
        );

        $found = [];

        foreach ($directories as $dir) {
            foreach (glob($dir.'/*.php') ?: [] as $file) {
                $source = file_get_contents($file);

                if (! preg_match('/namespace\s+([^;]+);/', $source, $nsMatch)) {
                    continue;
                }
                if (! preg_match('/\bclass\s+(\w+)/', $source, $classMatch)) {
                    continue;
                }

                $fqcn = trim($nsMatch[1]).'\\'.$classMatch[1];

                if (! class_exists($fqcn)) {
                    continue;
                }
                if (! is_subclass_of($fqcn, \Illuminate\Database\Eloquent\Model::class)) {
                    continue;
                }

                $traits = class_uses_recursive($fqcn);
                if (in_array(BelongsToTenant::class, $traits, true)) {
                    $found[] = $fqcn;
                }
            }
        }

        sort($found);

        return $found;
    }
}
