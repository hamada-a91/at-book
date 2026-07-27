# SPEC-13 – Offene Posten & Teilzahlungen (OPOS)

**Phase:** 3 · **Aufwand:** ~1–2 Wochen · **Abhängigkeiten:** SPEC-04 (Zahlungsbuchung via `InvoiceBookingService`/`BelegController`), SPEC-05 (Periodensperre/Festschreibung), SPEC-06 (Audit-Log) · **Ist Voraussetzung für:** SPEC-12 Teil B (Bankabgleich mit Teilzahlung) und SPEC-11A-EÜR (Zu-/Abfluss-Datierung) · **Status:** ✅ umgesetzt (27.07.2026)

## Ziel
Rechnungen und Belege können **teilweise** bezahlt werden. Der offene Betrag wird pro Dokument geführt (**Offene-Posten-Buchhaltung / OPOS**), und jede (Teil-)Zahlung erzeugt die passende Zahlungsbuchung. Damit werden Skonto, Teilzahlungen und Zahlungen über den Jahreswechsel korrekt abgebildet – die Grundlage für Bankabgleich (SPEC-12) und EÜR (SPEC-11A).

**Fachlicher Kern:** In der doppelten Buchführung trägt bereits das **Personenkonto (Debitor/Kreditor)** den offenen Betrag als Saldo – jede Teilzahlung bucht „Bank an Debitor" für den Teilbetrag, der Personenkonto-Saldo = Restforderung. Was fehlt, ist die **Verwaltung auf Dokumentebene** (`amount_paid`, Zahlungs-Ledger, Status). Kein separates „Abrechnungskonto" nötig; ein echtes Verrechnungs-/Zwischenkonto ist ein anderes Thema (nicht zuordenbare Bankumsätze → SPEC-12).

## Datenmodell

```php
// Neue Betragsfelder auf bestehenden Dokumenten
invoices:  + amount_paid (bigint Cents, default 0)
belege:    + amount_paid (bigint Cents, default 0)
// Zahlstatus wird ABGELEITET (nicht gespeichert): open_amount = total - amount_paid
//   open_amount == total        → offen
//   0 < open_amount < total      → teilweise_bezahlt
//   open_amount <= 0             → bezahlt
// invoices.status behält draft/booked/sent/paid/cancelled; 'paid' wird gesetzt,
// sobald open_amount <= 0. belege.is_paid analog (true bei open_amount <= 0).

// Zahlungs-Ledger (eine Zeile je Teilzahlung)
payments:  id, tenant_id (FK, index), public_id,
           payable_type (enum: invoice|beleg), payable_id,
           amount (bigint Cents, > 0),
           payment_date (date),
           payment_account_id (FK accounts – Kasse/Bank-Sachkonto),
           journal_entry_id (FK – die erzeugte Zahlungsbuchung),
           bank_transaction_id (nullable FK – Verknüpfung zu SPEC-12),
           discount_amount (bigint Cents, default 0),   # Skonto/Differenz
           discount_account_id (nullable FK accounts),
           note (nullable), created_at, updated_at
           index(['tenant_id', 'payable_type', 'payable_id'])
```

## Zahlungslogik (`PaymentService`)

`recordPayment(Model $payable, int $amount, string $date, int $paymentAccountId, ?int $bankTransactionId = null, ?int $discountAmount = null): Payment`

In einer `DB::transaction`:
1. Guards: Dokument ist gebucht (`booked`/`sent`), `amount > 0`, `amount <= open_amount + Skonto-Toleranz`, Periode offen (SPEC-05), Zahlungskonto ist Kasse/Bank und Skontokonto ist Aufwand/Ertrag.
2. Zahlungsbuchung über den bestehenden `BookingService`:
   - **Rechnung (Debitor):** `Bank an Debitor` über `amount` (+ ggf. `Skonto (Erlösschmälerung 8730) an Debitor` für die Differenz).
   - **Beleg (Kreditor/Aufwand):** `Kreditor/Aufwand an Bank` über `amount` (+ ggf. Skonto-Ertrag 4730).
   - Sofort festschreiben (`lockBooking`, GoBD).
3. `amount_paid += amount (+ discount_amount)`; Status neu ableiten; bei Vollzahlung `invoice.status = 'paid'` bzw. `beleg.is_paid = true`.
4. `payments`-Zeile anlegen; Audit-Event `payment_recorded`.

`reversePayment(Payment $p)`: storniert die Zahlungsbuchung (Generalumkehr, GoBD-konform), reduziert `amount_paid`, öffnet den Posten wieder, Audit-Event `payment_reversed`.

**Skonto/Toleranz:** Weicht die Zahlung um ≤ konfigurierbarer Toleranz (z.B. 2 %) vom offenen Betrag ab, darf die Differenz als Skonto/Rundung auf `discount_account_id` gebucht und der Posten geschlossen werden. Größere Abweichungen → Teilzahlung (Rest bleibt offen) oder expliziter Nutzer-Eingriff.

**Kompatibilität:** Der bestehende `InvoiceBookingService::recordPayment()` (Vollzahlung) wird auf `PaymentService` umgestellt – Vollzahlung = eine `payments`-Zeile über `total`. Bestehende Tests bleiben grün.

## API
```
POST   /api/invoices/{invoice}/payments   { amount, payment_date, payment_account_id, discount_amount?, discount_account_id? }
GET    /api/invoices/{invoice}/payments    # Liste + open_amount/Status
POST   /api/belege/{beleg}/payments
GET    /api/belege/{beleg}/payments
DELETE /api/payments/{payment}             # = reversePayment (Storno)
GET    /api/reports/open-items?type=debitor|kreditor&view=as_of&as_of=2026-07-27
GET    /api/reports/open-items?view=month&year=2026&month=7   # Stichtag Monatsende
GET    /api/reports/open-items?view=year&year=2026            # Stichtag Jahresende
```
Rollen: Zahlung erfassen/stornieren für `owner|manager|buchhalter`. Alle FK `TenantExists`.

## Frontend
- Zahlungs-Dialog (Rechnung/Beleg): zeigt **offenen Betrag**, markiert Pflichtfelder, erlaubt Teilbetrag + Zahlungskonto + optional Skonto und erklärt die 2-%-Grenze.
- Als Zahlungskonto erscheinen nur Kasse/Bank; als Skontokonto nur Aufwands-/Erlöskonten. Storno ist als rote Gefahr-Aktion dargestellt.
- Dokumentlisten/-detail: Badge **Offen / Teilweise bezahlt / Bezahlt** + offener Betrag.
- Neue Seite **Offene Posten** (`/{tenant}/open-items`): Debitoren-/Kreditoren-OP-Liste für Stichtag, Monat oder Jahr mit Fälligkeit und Restbetrag. Ein Klick auf eine Zeile öffnet die zugehörige Rechnungsvorschau oder Belegdetailseite.
- Die Sidebar zeigt die Anzahl aktuell offener und teilbezahlter Rechnungen/Belege als roten Zähler beim Eintrag **Offene Posten** und zusätzlich an der Gruppe **Buchhaltung**.
- Das Skontokonto wird über eine Suche nach Kontonummer oder Kontoname gewählt; ein verständliches Beispiel erklärt Skonto und die 2-%-Grenze.

## Akzeptanzkriterien
- [x] Zwei Teilzahlungen auf eine Rechnung → jeweils korrekte `Bank an Debitor`-Buchung; nach der zweiten `open_amount = 0`, Status `bezahlt`
- [x] Teilzahlung < offener Betrag → abgeleitet `teilweise_bezahlt`, Restbetrag bleibt offen (nächste Zahlung möglich)
- [x] Skonto innerhalb Toleranz schließt den Posten und bucht die Differenz aufs Skonto-Konto
- [x] Zahlung stornieren → Generalumkehr, `amount_paid` reduziert, Posten wieder offen
- [x] Periodensperre (SPEC-05) & Festschreibung greifen bei Zahlungsbuchungen
- [x] OP-Report listet nur offene/teilweise Posten mit korrektem Restbetrag; Tenant-isoliert
- [x] Bestehende Vollzahlungs-Tests (SPEC-04) weiterhin grün
- [x] Als bezahlt markierter Beleg ohne Zahlungskonto wird bereits bei der Validierung abgewiesen
- [x] Zahlung aus der Rechnungsliste verwendet denselben korrekten `open_amount` wie die Vorschau
- [x] Monats-/Jahresansicht wertet OPOS zum jeweiligen Periodenende aus
- [x] Sidebar-Zähler umfasst offene und teilbezahlte Rechnungen/Belege
- [x] Klick oder Tastaturaktion auf eine OPOS-Zeile öffnet das zugehörige Dokument
- [x] OPOS-Zähler ist auch bei geschlossener Buchhaltungsgruppe sichtbar
- [x] Skontokonto ist durchsuchbar und die Skonto-Hilfe enthält ein konkretes Beispiel

## Backup-Impact ⚠️
1. **Neue Tabelle `payments`** → Transformer + Registry-Eintrag (nach invoices/belege/journal_entries, da referenzierend) + Roundtrip-Test. Referenzen (payable invoice/beleg, journal_entry, bank_transaction, Konten) über `public_id`; Import via `ImportIdMapping`.
2. **Neue Spalten `invoices.amount_paid` / `belege.amount_paid`** → jeweiligen Transformer erweitern, Feld optional (alte Backups → Default 0, Status wird daraus abgeleitet).
3. Referenz-Fixture muss importierbar bleiben; Roundtrip um eine teilbezahlte Rechnung erweitern.

## Umsetzungsnachweis
- Backend: `PaymentService`, Payment-Ledger, Teilzahlung/Skonto, Generalumkehr und Legacy-Wrapper.
- API/UI: Zahlungsverwaltung für Rechnungen und Belege, OPOS-Zähler sowie Stichtags-, Monats- und Jahresansicht unter `/{tenant}/open-items`.
- Backup: `PaymentTransformer`, Import-ID-Mapping und eigener Cross-Tenant-Roundtrip-Test.
- Tests: `PaymentTest`, `PaymentBackupRoundtripTest` sowie bestehende Invoice-/Perioden-/Backup-Regressionen.
- SPEC-12-Hook: `bank_transaction_id` ist vorbereitet; der FK wird mit der späteren `bank_transactions`-Migration ergänzt.

## Einordnung in die Abhängigkeitskette
```
SPEC-13 (Offene Posten & Teilzahlungen)
   ├─► SPEC-12 Teil B  (Bankumsatz kann als Teilzahlung zugeordnet werden; Rest bleibt offen)
   └─► SPEC-11A-EÜR    (Zu-/Abflussprinzip braucht Zahlungsdatum + eindeutige OP-Zuordnung)
```
