# SPEC-05 – Lückenlose Nummernkreise & Periodenfestschreibung

**Phase:** 2 · **Aufwand:** ~3 Tage · **Abhängigkeiten:** SPEC-04 · **Behebt:** 08/Punkt 7 + Journal-TODO aus Punkt 10 + GoBD-Frist-Lücke (Entwürfe ohne Festschreibungszwang)

## Ziel
1. Race-freie, pro Tenant lückenlose Nummernvergabe für Rechnungen, Belege, Angebote, Aufträge, Lieferscheine und festgeschriebene Journalbuchungen.
2. **Periodenfestschreibung** wie in Lexware/DATEV: Alle Entwürfe bis Datum X in einem Rutsch festschreiben + Sperre gegen nachträgliche Erfassung in abgeschlossenen Zeiträumen. (GoBD: Buchungen müssen spätestens bis zur Abgabe der UStVA des Folgemonats festgeschrieben sein — aktuell können Entwürfe ewig offen bleiben.)

**Kontext:** Automatische Buchungen (Rechnung/Beleg/Zahlung) werden seit SPEC-04 sofort festgeschrieben — das bleibt so (lexoffice-Modell). Diese Spec betrifft die **manuellen Entwürfe** und den Monatsabschluss.

---

## Teil A – Nummernkreise

### Datenmodell

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

### Service `App\Services\NumberSequenceService`

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
- **Lückenlosigkeit durch Vergabezeitpunkt:** Nummer wird erst gezogen, wenn das Dokument tatsächlich entsteht/festgeschrieben wird – nicht für verworfene Drafts:
  - Rechnungen: weiterhin bei Erstellung (Drafts sind bei uns echte Rechnungen), **aber** innerhalb der Store-Transaktion.
  - Journalnummer (`journal_number`, neue nullable Spalte auf `journal_entries`): erst bei `lockBooking()`.
- Migration der Bestandsdaten: pro Tenant/Typ/Jahr `last_number` aus höchster vorhandener Nummer initialisieren (Datenmigration im selben PR).

### Umstellung der Aufrufer
`InvoiceController::store` (statt „max+1“-Logik), Beleg-/Quote-/Order-/DeliveryNote-Erstellung, `BookingService::lockBooking`.

---

## Teil B – Periodenfestschreibung (Monatsabschluss)

### Datenmodell
Neue Spalte `company_settings.books_locked_until` (date, nullable). Bedeutung: Alle Buchungen mit `booking_date <= books_locked_until` sind festgeschrieben; der Zeitraum ist für neue Erfassung gesperrt. **Monoton:** Das Datum kann nur vorwärts wandern, nie zurück.

### Service-Methode `BookingService::lockPeriod(Carbon $untilDate): int`
In einer DB-Transaktion:
1. Guard: `$untilDate` > aktuelles `books_locked_until` (sonst 422 „Zeitraum ist bereits festgeschrieben“).
2. Alle `draft`-Buchungen des Tenants mit `booking_date <= $untilDate` laden (sortiert nach `booking_date`, `id`) und einzeln über `lockBooking()` festschreiben → jede bekommt dabei ihre **lückenlose `journal_number`** aus Teil A (natürliche Verzahnung der beiden Teile).
3. `company_settings.books_locked_until = $untilDate` setzen.
4. Rückgabe: Anzahl festgeschriebener Buchungen.

### Erfassungssperre
- `BookingService::createBooking()`: `booking_date <= books_locked_until` → `DomainException` („Der Zeitraum bis {Datum} ist festgeschrieben – Buchung im offenen Zeitraum erfassen.“) → Controller: 422.
- Gilt auch für automatische Buchungen (Rechnung/Beleg): Belegdatum in gesperrter Periode → 422 mit Hinweis. (Rechnungs-/Belegdatum prüfen, bevor gebucht wird.)
- **Storno-Sonderfall:** `reverseBooking()` auf eine Buchung in gesperrter Periode ist erlaubt (GoBD-konform), aber die Storno-Buchung erhält als `booking_date` **max(Originaldatum, erster offener Tag)** – wie in DATEV wird im offenen Zeitraum storniert, die gesperrte Periode bleibt unverändert. Im Beschreibungstext das Originaldatum nennen („Storno zu Buchung vom …“).

### API
```
POST /api/bookings/lock-period   { "until_date": "2026-06-30" }   → { locked_count, books_locked_until }
GET  /api/bookings/lock-status   → { books_locked_until, open_drafts_count, oldest_open_draft_date,
                                     gobd_deadline_exceeded: bool }  # Entwürfe älter als Ende Vormonat?
```
Berechtigung: nur Rollen `owner` und `buchhalter` dürfen `lock-period` ausführen (Middleware/Policy + Test).

### Frontend
1. Journal-Seite (`JournalList.tsx`): Button **„Zeitraum festschreiben“** → Dialog mit Datumswahl (Default: letzter Tag des Vormonats) + Bestätigung mit Anzahl betroffener Entwürfe + Warnhinweis „unwiderruflich, Korrektur nur per Storno“.
2. **Hinweis-Banner** im Journal (Daten aus `lock-status`): „X Entwürfe älter als der Vormonat – GoBD-Frist beachten“ (nur wenn `gobd_deadline_exceeded`).
3. Buchungsmaske: Datumsfeld validiert client-seitig gegen `books_locked_until` (Server bleibt die Autorität).

---

## Akzeptanzkriterien

### Teil A
- [ ] Paralleltest: 20 gleichzeitige Rechnungs-Erstellungen → 20 fortlaufende, eindeutige Nummern
- [ ] Zwei Tenants haben unabhängige Kreise (beide bekommen `RE-2026-0001`)
- [ ] `lockBooking` vergibt fortlaufende `journal_number` ohne Lücken; Storno bekommt eigene neue Nummer
- [ ] Jahreswechsel: neuer Kreis ab `0001`
- [ ] Bestandsdaten-Migration: nächste Nummer schließt korrekt an höchste Alt-Nummer an

### Teil B
- [ ] `lock-period` schreibt genau die Entwürfe bis zum Datum fest (spätere bleiben draft) und vergibt lückenlose Journalnummern in Datumsreihenfolge
- [ ] Neue Buchung mit Datum in gesperrter Periode → 422 (manuell UND via Rechnung/Beleg-Buchen)
- [ ] `lock-period` mit Datum vor bestehendem `books_locked_until` → 422 (monoton)
- [ ] Storno einer Buchung aus gesperrter Periode: Original unverändert, Storno-Buchung im offenen Zeitraum, Summen neutralisieren sich
- [ ] `cachier`/`manager` erhalten auf `lock-period` 403
- [ ] `lock-status` meldet `gobd_deadline_exceeded` korrekt (Entwurf vom Vorvormonat → true)
- [ ] Tenant-Isolation: `lock-period` von Tenant A lässt Entwürfe von Tenant B unberührt

## Backup-Impact ⚠️
1. **Neue Tabelle `number_sequences`:** Empfehlung **Rekonstruktion beim Import** statt Export – der Import leitet `last_number` aus den importierten Dokumenten/Journalnummern ab (überlebt auch alte/manipulierte Backups). Tabelle bewusst NICHT in die Registry aufnehmen, aber als dokumentierte Ausnahme im Roundtrip-Vollständigkeits-Check eintragen + Import-Rekonstruktion implementieren und testen. (Alternative Export+Transformer nur, falls Rekonstruktion nicht zuverlässig möglich – Entscheidung im PR dokumentieren.)
2. **Neue Spalte `journal_entries.journal_number`** → `JournalEntryTransformer` erweitern (Export + Import, optional für alte Backups). Alte festgeschriebene Buchungen ohne Nummer behalten `null` – zulässig, dokumentieren.
3. **Neue Spalte `company_settings.books_locked_until`** → `CompanySettingTransformer` erweitern (optional für alte Backups; nach Import eines Alt-Backups gilt: keine Periodensperre).
4. Roundtrip-Test um alle drei Punkte erweitern; Referenz-Fixture `backup-v1.0-referenz.json` muss weiterhin importierbar sein.
