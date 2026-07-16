# SPEC-02 – Tests, CI & Backup-Regressionsanker

**Phase:** 1 · **Aufwand:** ~2–3 Tage · **Abhängigkeiten:** SPEC-01 · **Behebt:** 08/Punkt 17 (teilweise)

## Ziel
Bevor an Schema und Buchungslogik gearbeitet wird, brauchen wir ein Sicherheitsnetz – **insbesondere für das Backup-Modul**. Dieses Paket liefert den automatischen Wächter, der bei jeder späteren Änderung Alarm schlägt.

## Umfang

### 2.1 Backup-Roundtrip-Regressionstest (Kernstück!)
`tests/Feature/Backup/BackupRoundtripTest.php`:

1. **Arrange:** Tenant A mit realistischem Datenbestand seeden – mindestens: 2 Konten, 1 Kontakt (mit Debitorenkonto), 1 Produkt + Kategorie, 1 Angebot→Auftrag→Rechnung-Kette mit Zeilen, 1 Beleg mit Zeilen, 1 gebuchte + festgeschriebene Journalbuchung, 1 stornierte Buchung, 1 Bankkonto, Company Settings, 1 Lagerbewegung. (Als wiederverwendbare Factory/Seeder-Methode `TenantTestDataFactory` bauen – wird auch von anderen Tests genutzt.)
2. **Act:** Export synchron ausführen (`BackupExportService` direkt, nicht über Queue) → JSON. Frischen Tenant B anlegen → `BackupImportService` mit dem JSON.
3. **Assert:**
   - Zähler pro Entity-Typ identisch (alle Typen aus `EntityTransformerRegistry` durchiterieren – **so schlägt der Test automatisch fehl, wenn eine neue Entity ohne Transformer dazukommt**: Registry-Typen gegen Liste der Models mit `BelongsToTenant` diffen!).
   - Stichproben-Felder gleich (Beträge in Cents, Status, `locked_at`, Storno-Verknüpfung).
   - Beziehungen korrekt neu verknüpft (Rechnung→Kontakt, Journalzeile→Konto) – via `public_id`-Vergleich.
   - Tenant-Isolation: Import hat **nichts** in Tenant A verändert.
4. **Kompatibilitätstest:** eine eingefrorene Beispiel-Backup-Datei (`tests/Fixtures/backup-v1.0-referenz.json`) muss dauerhaft importierbar bleiben. Diese Fixture beim Erstellen dieser Spec einmal aus dem Roundtrip-Export erzeugen und einchecken. **Sie ist der Vertrag mit alten Kundenbackups.**

### 2.2 Kern-Feature-Tests
| Test | Prüft |
|---|---|
| `BookingServiceTest` | Soll=Haben-Pflicht (unausgeglichen → Exception), Draft-Erstellung, `lock()` macht unveränderlich, `reverse()` erzeugt korrekte Gegenbuchung + Original `cancelled` |
| `InvoiceBookingTest` | `POST /invoices/{id}/book` erzeugt ausgeglichenen JournalEntry (brutto=netto+USt), Invoice→`booked`, Lagerabgang bei Produktzeilen |
| `TenantIsolationTest` (erweitern) | Listen-Endpoints liefern nur eigene Daten; Fremd-IDs in `show` → 404 |
| `GobdTest` | Update/Delete auf `locked_at`-Buchung → Fehler |

### 2.3 CI-Pipeline (GitHub Actions, `.github/workflows/ci.yml`)
```yaml
on: [push, pull_request]
jobs: 
  test:   # PostgreSQL-Service-Container (postgres:18), PHP 8.4
    - composer install
    - vendor/bin/pint --test
    - php artisan test          # inkl. Backup-Roundtrip!
  build:
    - npm ci && npm run build   # TS-Fehler brechen den Build
```
- `phpunit.xml` prüfen: Testing-DB (`testing`-Datenbank aus dem Sail-Init-Skript vorhanden) + `RefreshDatabase` in den neuen Tests.

## Akzeptanzkriterien
- [ ] Roundtrip-Test deckt **alle** Registry-Entities ab und schlägt fehl, wenn ein `BelongsToTenant`-Model ohne Transformer existiert
- [ ] Referenz-Fixture `backup-v1.0-referenz.json` eingecheckt und Import-Test grün
- [ ] Alle 2.2-Tests grün; Gesamtlaufzeit < 5 min
- [ ] CI läuft bei jedem Push; roter Backup-Test blockiert Merge

## Backup-Impact
Positiv – dieses Paket **ist** der Backup-Schutz. Danach gilt: kein Merge mit rotem `--filter=Backup`. ✅
