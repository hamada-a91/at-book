# SPEC-12 – Bankabgleich: Kontoauszug-Import & Zuordnung

**Phase:** 3 (vorgezogen – vor SPEC-09/10 auf Wunsch) · **Aufwand:** ~2–3 Wochen (Teil A + B) · **Abhängigkeiten:** SPEC-04 (Zahlungsbuchung via `InvoiceBookingService`/`BelegController`), SPEC-05 (Periodensperre), SPEC-06 (Audit-Log), SPEC-08 (Kostenzuordnung durchreichen) · **Vorbild:** Lexware „Umsätze importieren" + „Umsatz zuordnen"

## Ziel
Bankumsätze aus einer **CSV-Datei importieren** (mit anpassbarem Mapping), sie als Liste vorhalten und anschließend **Belegen / Rechnungen / Kategorien zuordnen** – wobei die Zuordnung automatisch die passende **Zahlungsbuchung** (Bank an Debitor / Aufwand an Bank …) erzeugt. Ziel ist ein Ablauf wie in Lexware, aber **effizienter** durch automatische Zuordnungsvorschläge, Sammelbestätigung und lernende Regeln.

**Nicht in Scope (Ausblick):** direkter Bankabruf via FinTS/PSD2 (nur CSV-Import jetzt), Teilzahlungen (das aktuelle Modell kennt nur „voll bezahlt" – siehe Offene Punkte).

---

## Datenmodell

```php
bank_import_batches:   id, tenant_id (FK, index), public_id, bank_account_id (FK),
                       user_id, filename, settings (jsonb: delimiter/encoding/mapping/sign),
                       total_rows, imported_count, skipped_count, created_at

bank_transactions:     id, tenant_id (FK, index), public_id,
                       bank_account_id (FK, index), import_batch_id (nullable FK),
                       booking_date (date), value_date (date, nullable),
                       counterparty (string, nullable),        # Auftraggeber/Empfänger
                       purpose (text, nullable),               # Verwendungszweck
                       amount (bigint Cents, SIGNIERT: negativ = Abgang, positiv = Eingang),
                       currency (string, default 'EUR'),
                       fingerprint (string, index),            # Dedup-Hash
                       status (enum: unmatched|matched|ignored) default unmatched,
                       matched_type (nullable: invoice|beleg|journal_entry|category),
                       matched_id (nullable),                  # id des zugeordneten Objekts
                       journal_entry_id (nullable FK),         # erzeugte Zahlungsbuchung
                       raw (jsonb),                            # Original-CSV-Zeile (Nachweis/GoBD)
                       notes (nullable), created_at, updated_at
                       unique(['tenant_id', 'fingerprint'])    # Dedup pro Tenant
```

- **Vorzeichen-Konvention intern:** `amount` ist signiert – negativ = Geld raus (Ausgabe), positiv = Geld rein (Einnahme). Der Import-Toggle „Einnahmen negativ / Ausgaben positiv" dreht das Vorzeichen beim Parsen um, sodass intern immer dieselbe Konvention gilt.
- **Fingerprint** (Dedup): `sha1(bank_account_id | booking_date | amount | normalize(purpose) | normalize(counterparty))`. Verhindert doppelten Import derselben Zeile bei erneutem Hochladen überlappender Auszüge.
- `raw` speichert die Originalzeile unverändert (GoBD-Nachweis, Basis für „nicht importierte herunterladen").

---

## Teil A – Import

### Ablauf
1. **Upload + Vorschau** `POST /api/bank-imports/preview` (multipart: file, bank_account_id): Server parst die ersten ~20 Zeilen, erkennt Trennzeichen/Encoding heuristisch, rät ein Spalten-Mapping und liefert Kopfzeilen + Beispielzeilen + erkannte Gesamtzahl zurück. **Keine** Persistenz.
2. **Konfiguration im UI** (Muster Lexware-Screenshot): Trennzeichen, Zeichenkodierung (UTF-8/ISO-8859-1/Windows-1252), Textqualifizierer, Vorzeichen-Toggle, Spalten-Mapping (Buchungsdatum · Auftraggeber/Empfänger · Verwendungszweck · Betrag [oder getrennte Soll-/Haben-Spalten] · optional Wertstellung). Mapping-Presets pro Bank in `company_settings` merkbar (Bonus, Teil B).
3. **Import** `POST /api/bank-imports` (file + settings + bank_account_id): parst alle Zeilen, baut je Zeile den Fingerprint, überspringt Duplikate (bereits vorhandener Fingerprint), ungültige (fehlendes Datum/Betrag) und Zeilen vor dem 01.01.2014 (wie Lexware). Legt einen `bank_import_batches`-Datensatz an, speichert gültige Zeilen als `bank_transactions` (status `unmatched`). Antwort: `{ imported, skipped, not_imported_rows }`.
4. **Nicht-importierte herunterladen** `GET /api/bank-imports/{batch}/skipped` → CSV der übersprungenen Zeilen inkl. Grund-Spalte.

### Robustheit
- CSV-Parsing serverseitig (`league/csv` empfohlen, oder `fgetcsv`) – deterministisch, unabhängig vom Browser.
- Beträge: deutsches (`1.234,56`) UND englisches (`1234.56`) Format erkennen; Tausenderpunkt/Komma normalisieren → int Cents.
- Datumsformate tolerant parsen (Carbon `createFromFormat` mit mehreren Kandidaten; das Lexware-Beispiel zeigt `31.03.2026 03:00:24`).

---

## Teil B – Zuordnung (Reconciliation)

### UI (Muster Lexware „Umsätze" + „Umsatz zuordnen")
Seite `/{tenant}/banking` mit Tabs:
- **Vorschläge prüfen** (Auto-Matches mit hoher Konfidenz, Sammelbestätigung möglich)
- **Zuzuordnen** (offene Umsätze, status `unmatched`)
- **Alle Umsätze** (mit Filtern: Bankkonto, Zeitraum, Typ, Suche)

Rechtes Zuordnungs-Panel je Umsatz mit zwei Wegen:
- **Beleg/Rechnung wählen:** Liste passender offener Belege/Rechnungen (nach Betrag/Datum/Kontakt gefiltert) → Auswahl erzeugt die Zahlungsbuchung.
- **Kategorie wählen:** direktes Sachkonto (Aufwand/Erlös) für Umsätze ohne Beleg (z.B. „Google One" → Aufwandskonto). Bucht Aufwand/Erlös direkt gegen das Bankkonto (Muster: Barbeleg ohne Kontakt, SPEC-08).

### Zuordnungs-Logik (Service `BankReconciliationService`)
Beim Zuordnen (`POST /api/bank-transactions/{tx}/assign`):
| Ziel | Buchung | Vorbedingung |
|---|---|---|
| **Invoice** (Eingang +) | `InvoiceBookingService::recordPayment()` (Bank an Debitor) | Betrag = invoice.total, Invoice-Status booked/sent |
| **Beleg** (Ausgang −) | Zahlungsbuchung Kreditor/Aufwand an Bank; Beleg `is_paid=true` | Beleg existiert |
| **Kategorie/Sachkonto** | Aufwand/Erlös an Bank direkt (netto+USt aus Steuersatz, oder ohne USt) | – |

- Das **Bankkonto-Sachkonto** (`bank_accounts.account_id`) ist immer die Bank-Seite der Buchung.
- Nach erfolgreicher Buchung: `bank_transaction.status=matched`, `matched_type/id`, `journal_entry_id` gesetzt. Audit-Event `bank_tx_assigned`.
- **Ignorieren** `POST /api/bank-transactions/{tx}/ignore`: status `ignored`, keine Buchung (z.B. Umbuchung zwischen eigenen Konten).
- **Zuordnung aufheben** `POST /api/bank-transactions/{tx}/unassign`: storniert die erzeugte Zahlungsbuchung (Generalumkehr, GoBD-konform), setzt status zurück auf `unmatched`. Audit-Event `bank_tx_unassigned`.

### Auto-Matching & „effizienter als Lexware"
`BankMatchingService::suggest(tx)` – Score aus:
1. **Betrag exakt** (Pflicht-Signal): gleicher Betrag ± 0.
2. **Referenz**: Rechnungs-/Belegnummer im Verwendungszweck (`RE-2026-…`, `lx…`) → sehr hohe Konfidenz.
3. **Kontakt**: Auftraggeber/Empfänger ~ Kontaktname (Fuzzy).
4. **Datumsnähe** (± Tage).
Nur Vorschläge oberhalb einer Schwelle landen im Tab „Vorschläge"; **Sammelbestätigung** („alle übernehmen") für die Effizienz.

**Lern-Regeln (der eigentliche Effizienzgewinn):** Tabelle `bank_matching_rules` (tenant_id, match_on: counterparty/purpose-Pattern, action: category-account/contact) – gefüttert aus bestätigten Zuordnungen. Beim Import wird jeder neue Umsatz gegen die Regeln geprüft und ggf. direkt vorgeschlagen (z.B. „Verwendungszweck enthält 'Google' → Konto 6800"). Optional Auto-Buchen bei 100%-Regeln (per Tenant-Flag, mit Audit-Log; Default: nur Vorschlag).

---

## API (Übersicht)
```
POST /api/bank-imports/preview           # Vorschau + Mapping-Vorschlag
POST /api/bank-imports                    # Import ausführen
GET  /api/bank-imports/{batch}/skipped    # übersprungene Zeilen als CSV
GET  /api/bank-transactions?bank_account_id&status&from&to&q   # Liste (paginiert)
GET  /api/bank-transactions/suggestions   # Auto-Match-Vorschläge (Tab "Vorschläge")
POST /api/bank-transactions/{tx}/assign   # {target_type, target_id | account_id, ...}
POST /api/bank-transactions/{tx}/ignore
POST /api/bank-transactions/{tx}/unassign
```
Rollen: Import + Zuordnung für `owner|manager|buchhalter` (Schreibrouten mit `role`-Middleware). Alle FK tenant-scoped (`TenantExists`).

## Frontend
- Seite `pages/Banking/BankingList.tsx` (Tabs + Filter + Umsatzliste), Zuordnungs-Panel `AssignTransactionPanel.tsx` (Beleg/Rechnung/Kategorie), Import-Wizard `ImportWizard.tsx` (Upload → Mapping-Vorschau → Ergebnis), Menüpunkt „Banking" unter **Buchhaltung** (oder eigener Hauptpunkt). Beträge über `lib/currency.ts`, deutsche Texte.

---

## Akzeptanzkriterien
- [ ] CSV-Import mit konfigurierbarem Trennzeichen/Encoding/Mapping + Vorzeichen-Toggle; deutsche & englische Betragsformate korrekt als Cents
- [ ] Erneuter Import überlappender Auszüge legt **keine Duplikate** an (Fingerprint); übersprungene Zeilen herunterladbar
- [ ] Zuordnung Umsatz→Rechnung erzeugt korrekte Zahlungsbuchung (Bank an Debitor), Invoice wird `paid`
- [ ] Zuordnung Umsatz→Beleg bucht Zahlung + `is_paid`; Umsatz→Kategorie bucht Aufwand/Erlös an Bank
- [ ] „Ignorieren" bucht nichts; „Zuordnung aufheben" storniert die Buchung (GoBD) und setzt Umsatz auf offen
- [ ] Auto-Match-Vorschläge (Betrag+Referenz) erscheinen im Tab „Vorschläge"; Sammelbestätigung funktioniert
- [ ] Lern-Regel: nach 1× Zuordnung „Google → Konto X" wird der nächste „Google"-Umsatz vorgeschlagen
- [ ] Periodensperre (SPEC-05) & Festschreibung greifen bei den erzeugten Buchungen
- [ ] Tenant-Isolation für alle neuen Entities; Rollen (`cachier` → 403 auf Import/Zuordnung)

## Backup-Impact ⚠️
1. **Neue tenant-scoped Tabellen** `bank_import_batches`, `bank_transactions`, `bank_matching_rules` → je Transformer + Registry-Eintrag + Roundtrip-Erweiterung. Referenzen (bank_account, matched invoice/beleg, journal_entry) über `public_id` exportieren, Import via `ImportIdMapping` zurückmappen; `matched_id`/`journal_entry_id` bei fehlendem Ziel `null` (Historie bleibt).
2. `raw`-JSON + `fingerprint` mit exportieren (Dedup bleibt nach Restore erhalten).
3. Alle neuen Felder optional → alte Backups importierbar; Referenz-Fixture muss grün bleiben.
4. `bank_matching_rules` sind Tenant-Konfiguration → mit exportieren (Lern-Wissen überlebt Restore).

## Umsetzung in zwei Teilen (wie SPEC-08)
- **Teil A:** Datenmodell, CSV-Parser/Import (Preview + Import + Dedup + skipped-Download), Umsatzliste-API + Backup-Integration + Tests. (Kein Matching.)
- **Teil B:** Zuordnung (assign/ignore/unassign → Zahlungsbuchungen), Auto-Match + Lern-Regeln, komplettes Frontend (Wizard + Banking-Seite).

## Offene fachliche Punkte (vor Teil B entscheiden)
- **Teilzahlungen:** Das aktuelle Modell kennt nur „voll bezahlt" (Invoice→`paid`, Beleg→`is_paid`). Für abweichende Beträge (Skonto, Teilzahlung) braucht es entweder eine Toleranz + Differenzbuchung (Skonto/Rundung) oder ein echtes Zahlungs-Ledger. Empfehlung: in Teil B zunächst nur exakte Beträge automatisch, abweichende manuell mit Differenz-auf-Konto.
- **Verrechnungskonto/Umbuchungen** zwischen eigenen Bankkonten: als „Ignorieren" oder eigenes Ziel „Umbuchung".
