# SPEC-05 – Lückenlose Nummernkreise

**Phase:** 2 · **Aufwand:** ~2 Tage · **Abhängigkeiten:** SPEC-04 · **Behebt:** 08/Punkt 7 + Journal-TODO aus Punkt 10

## Ziel
Race-freie, pro Tenant lückenlose Nummernvergabe für Rechnungen, Belege, Angebote, Aufträge, Lieferscheine und (neu) festgeschriebene Journalbuchungen.

## Datenmodell

```php
Schema::create('number_sequences', function (Blueprint $table) {
    $table->id();
    $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
    $table->string('type');            // invoice, beleg, quote, order, delivery_note, journal
    $table->unsignedInteger('year');   // 0 = jahresunabhängig (journal)
    $table->unsignedBigInteger('last_number')->default(0);
    $table->string('format')->default('RE-{YYYY}-{NNNN}');  // pro Typ konfigurierbar
    $table->timestamps();
    $table->unique(['tenant_id', 'type', 'year']);
    $table->index('tenant_id');
});
```

## Service `App\Services\NumberSequenceService`

```php
public function next(string $type, ?int $year = null): string
{
    // MUSS innerhalb einer bestehenden DB-Transaktion aufgerufen werden!
    $seq = NumberSequence::query()
        ->where(['tenant_id' => tenant()->id, 'type' => $type, 'year' => $year ?? 0])
        ->lockForUpdate()
        ->firstOrCreate([...]);
    $seq->increment('last_number');
    return $this->format($seq);
}
```

- `lockForUpdate()` (Postgres `SELECT … FOR UPDATE`) serialisiert parallele Vergaben → keine Duplikate, keine Lücken durch Race.
- **Lückenlosigkeit durch Vergabezeitpunkt:** Nummer wird erst gezogen, wenn das Dokument tatsächlich entsteht/festgeschrieben wird – nicht für verworfenene Drafts:
  - Rechnungen: weiterhin bei Erstellung (Drafts sind bei uns echte Rechnungen), **aber** innerhalb der Store-Transaktion.
  - Journalnummer (`journal_number`, neue nullable Spalte auf `journal_entries`): erst bei `lockBooking()` – erfüllt das GoBD-TODO.
- Migration der Bestandsdaten: pro Tenant/Typ/Jahr `last_number` aus höchster vorhandener Nummer initialisieren (Datenmigration im selben PR).

## Umstellung der Aufrufer
`InvoiceController::store` (statt „max+1“-Logik), Beleg-/Quote-/Order-/DeliveryNote-Erstellung, `BookingService::lockBooking`.

## Akzeptanzkriterien
- [ ] Paralleltest: 20 gleichzeitige Rechnungs-Erstellungen → 20 fortlaufende, eindeutige Nummern (Test mit mehreren DB-Verbindungen oder sequentielle Simulation + Unique-Constraint-Nachweis)
- [ ] Zwei Tenants haben unabhängige Kreise (beide bekommen `RE-2026-0001`)
- [ ] `lockBooking` vergibt fortlaufende `journal_number` ohne Lücken; Storno bekommt eigene neue Nummer
- [ ] Jahreswechsel: neuer Kreis ab `0001`
- [ ] Bestandsdaten-Migration: nächste Nummer schließt korrekt an höchste Alt-Nummer an

## Backup-Impact ⚠️
1. **Neue Tabelle `number_sequences`** → neuer `NumberSequenceTransformer` + Registry-Eintrag, sonst beginnen Nummern nach einem Restore wieder bei 1 → **Duplikat-Katastrophe**. Alternativ (robuster): Import rekonstruiert `last_number` aus den importierten Dokumenten – dann Tabelle bewusst NICHT exportieren und das im Import-Service implementieren + testen. **Entscheidung im PR dokumentieren.** Empfehlung: Rekonstruktion (überlebt auch manipulierte/alte Backups).
2. **Neue Spalte `journal_entries.journal_number`** → `JournalEntryTransformer` erweitern (Export + Import, Feld optional für alte Backups).
3. Roundtrip-Test (SPEC-02) um beide Punkte erweitern; Referenz-Fixture v1.0 muss weiterhin importierbar sein (journal_number bleibt dann null → beim nächsten Lock neu vergeben? Nein: alte festgeschriebene Buchungen behalten null, ist zulässig – dokumentieren).
