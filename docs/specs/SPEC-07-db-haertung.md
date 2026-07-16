# SPEC-07 – DB-Härtung: Betragsspalten, Indizes, Caching

**Phase:** 2 · **Aufwand:** ~1–2 Tage · **Abhängigkeiten:** SPEC-02 · **Behebt:** 08/Punkte 11, 13, 14

## Ziel
Konsistente Betragsspalten, performante Tenant-Queries, weniger überflüssige Requests-Queries. **Alle Änderungen sind backup-sensibel → Schutzregeln strikt einhalten.**

## Umsetzung

### 7.1 Betragsspalten vereinheitlichen (`integer` → `bigInteger`)
Eine Migration, die alle Cent-Spalten auf `bigInteger` hebt:

| Tabelle | Spalten |
|---|---|
| `invoices` | `subtotal`, `tax_total`, `total` |
| `invoice_lines` | `unit_price`, `line_total` (+ ggf. tax) |
| `quotes`/`quote_lines`, `orders`/`order_lines`, `delivery_note_lines` | analoge Spalten |
| `projects` später (SPEC-08) | direkt bigint anlegen |

Postgres: `ALTER TABLE … ALTER COLUMN … TYPE bigint` ist verlustfrei (Aufwärtskonvertierung). Zusätzlich im Code: Zeilensummen mit `(int) round(...)` festziehen, damit keine Floats in Integer-Spalten fließen (`InvoiceController::store`-Berechnung).

### 7.2 `tenant_id`-Indizes
Migration mit Indizes für alle Tabellen, deren tenant_id bisher un-indiziert ist (Composite-Uniques zählen als Index für accounts/tax_codes/invoices/belege):

```php
$table->index(['tenant_id', 'booking_date']);   // journal_entries
$table->index('tenant_id');                     // contacts, bank_accounts, company_settings,
                                                // products, product_categories, quotes, orders,
                                                // delivery_notes, inventory_transactions, bug_reports,
                                                // backup_jobs, users
$table->index(['tenant_id', 'status']);         // invoices, belege (zusätzlich zu Unique)
```
Vorher mit `\d+ tabelle` (psql) prüfen, was schon existiert – keine Duplikat-Indizes anlegen.

### 7.3 Onboarding-Status cachen
`OnboardingMiddleware`: `Cache::remember("onboarding_done:{tenant_id}", 3600, …)`; Invalidierung in `OnboardingController::complete()` (und `onboarding:reset`-Command). Achtung: Cache-Store ist `database` – trotzdem billiger als das breite `company_settings`-SELECT; optional später Redis.

### 7.4 Aufräumen (aus 08/P3, hier miterledigen)
- Tote Dateien löschen: `app/Http/Controllers/Api/InvoiceController_PDF_SNIPPET.php`, `InvoiceController_UPDATE.php`, `resources/js/pages/Onboarding.tsx.broken`, `debug_*.php`, `booking_test.json`.
- Root-MD-Altlasten nach `archive/` verschieben (Liste in 08/Punkt 20), `.phpunit.result.cache` in `.gitignore`.

## Akzeptanzkriterien
- [ ] Alle Betragsspalten `bigint` (`\d invoices` etc.); Rechnung über 25 Mio € anlegbar (Test)
- [ ] `EXPLAIN` auf `journal_entries WHERE tenant_id=… ORDER BY booking_date` nutzt den neuen Index
- [ ] Onboarding-Middleware macht bei warmem Cache keine `company_settings`-Query (Query-Log-Test)
- [ ] Cache wird bei `onboarding/complete` invalidiert (Test: complete → Fach-Route sofort erreichbar)
- [ ] App-Verzeichnis enthält keine der toten Dateien mehr; `composer dump-autoload` fehlerfrei

## Backup-Impact ⚠️ (höchste Aufmerksamkeit in diesem Paket)
1. **Spaltentyp-Änderung (int→bigint) ist format-kompatibel:** JSON kennt nur Zahlen – Export/Import unverändert. Trotzdem Roundtrip-Test mit einem > 2^31-Cent-Betrag ergänzen.
2. **`schema_version`-Hash ändert sich** durch die Migrationen → prüfen, wie streng `BackupImportService`-Validierung den Hash vergleicht. Wenn Hash-Gleichheit erzwungen wird: Vergleich auf Warnung statt Abbruch umstellen (sonst werden alle Alt-Backups abgewiesen!). **Dieser Punkt ist Pflicht-Review vor dem Merge.**
3. Referenz-Fixture v1.0 (SPEC-02) muss nach den Migrationen weiterhin importieren.
4. Neue Indizes/gelöschte tote Dateien: kein Backup-Einfluss. ✅
