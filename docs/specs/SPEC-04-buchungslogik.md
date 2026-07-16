# SPEC-04 – Buchungslogik härten

**Phase:** 2 · **Aufwand:** ~3–5 Tage · **Abhängigkeiten:** SPEC-02, SPEC-03 · **Behebt:** 08/Punkte 6, 8, 10, 12 (teilw.)

## Ziel
Alle automatischen Buchungen (Rechnung, Zahlung, Beleg) laufen transaktional über den `BookingService`, werden korrekt festgeschrieben und nutzen konfigurierte Steuerkonten statt hartcodierter SKR03-Nummern.

## Umsetzung

### 4.1 Neuer Service `App\Modules\Accounting\Services\InvoiceBookingService`
Verschiebt die Logik aus `InvoiceController::book()` / `recordPayment()`:

```php
public function bookInvoice(Invoice $invoice): JournalEntry
{
    return DB::transaction(function () use ($invoice) {
        $this->assertBookable($invoice);          // Status, Kontakt, Debitorenkonto
        $lines = $this->buildLines($invoice);     // Soll Debitor / Haben Erlöse je (Konto, Steuersatz) / Haben USt je Steuersatz
        $entry = $this->bookingService->createBooking([...]);   // Soll=Haben-Check inklusive
        $this->bookingService->lockBooking($entry->id);         // GoBD: sofort festschreiben
        $invoice->update(['status' => 'booked', 'journal_entry_id' => $entry->id]);
        $this->reduceInventory($invoice);         // InventoryService, innerhalb derselben Transaktion
        return $entry->fresh('lines');
    });
}
```

Analog `BelegBookingService` bzw. Erweiterung des bestehenden Beleg-Book-Flows.

### 4.2 USt-Konten-Auflösung über `tax_codes`
- Neue Methode `TaxCode::resolveOutputTaxAccount(float $rate): Account` – sucht den Tenant-`tax_codes`-Eintrag zum Steuersatz und liefert dessen verknüpftes Automatikkonto; Fallback auf Konto-Codes nur noch als letzte Stufe mit klarer Fehlermeldung („Kein USt-Konto für 7% konfiguriert“ → 422, **keine stille Auslassung** wie bisher).
- USt wird **je Steuersatz-Gruppe** gebucht (nicht mehr `tax_total` pauschal auf 1776): 19%-Zeilen → 1776, 7%-Zeilen → 1771.
- Rundung: Steuer je Gruppe = `(int) round(nettoGruppe * satz / 100)`; Differenz zur Invoice-`tax_total` ≤ 1 Cent pro Gruppe zulässig, sonst Fehler.

### 4.3 `BookingService`-Fixes
- `user_id => Auth::id() ?? 1` ersetzen: Auth-User verpflichtend, sonst explizit übergebener `$userId`-Parameter (für Service-Aufrufe aus Jobs); ohne beides → Exception.
- Summenvergleich: `$debitSum = (int) collect(...)->sum(...)` casten, Vergleich mit `!==` beibehalten.
- `createBooking` akzeptiert optional `autoLock: true` (für Rechnungsbuchungen).
- Kommentar-TODO „gapless journal number“ bleibt → wird in SPEC-05 umgesetzt (Schnittstelle: `lockBooking` ruft dann den Nummernkreis auf).

### 4.4 Controller verschlanken
- `InvoiceController::book()` → dünner Wrapper um den Service (try/catch, 422 mit Fachmeldung statt 500 mit Exception-Text; **keine rohen Exception-Messages** mehr nach außen).
- `recordPayment()` ebenso (Kasse/Bank an Debitor, transaktional, Buchung festschreiben).
- FormRequests einführen: `StoreInvoiceRequest`, `BookInvoiceRequest` (nutzt `TenantExists` aus SPEC-03).

## Akzeptanzkriterien
- [ ] Buchung einer Rechnung mit gemischten Steuersätzen (19% + 7%) erzeugt korrekte Zeilen je USt-Konto; Soll=Haben; Test vorhanden
- [ ] Erzeugter JournalEntry hat `locked_at` gesetzt; nachträgliches Ändern schlägt fehl
- [ ] Simulierter Fehler mitten im Buchen (z.B. fehlendes USt-Konto) hinterlässt **keinen** JournalEntry, keine Invoice-Statusänderung, keinen Lagerabgang (Transaktions-Test)
- [ ] Kein `Account::where('code', '1776')` mehr im Controller (`git grep 1776 app/Http` leer)
- [ ] Fehlerantworten: 422 mit deutscher Fachmeldung, kein Stacktrace/Exception-Text

## Backup-Impact
Keine Schema-Änderung an exportierten Tabellen (nur Codepfade). `locked_at` wird bereits exportiert/importiert – Roundtrip-Test (SPEC-02) deckt festgeschriebene Buchungen ab. Falls `tax_codes` eine neue Spalte fürs Konto-Mapping braucht (`account_id` prüfen – existiert ggf. schon): **Transformer `TaxCodeTransformer` erweitern + Fixture-Kompatibilität testen** (Backup-Schutzregel 2). ⚠️
