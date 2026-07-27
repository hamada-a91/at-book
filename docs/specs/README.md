# Specs – Arbeitspakete mit Spezifikation

Jede Datei ist eine eigenständig umsetzbare Spezifikation. Reihenfolge und Abhängigkeiten: [../10-verbesserungsplan.md](../10-verbesserungsplan.md).

| Spec | Titel | Phase | Status |
|---|---|---|---|
| [SPEC-01](SPEC-01-sicherheits-hotfixes.md) | Sicherheits-Hotfixes (P0) | 0 | ✅ fertig |
| [SPEC-02](SPEC-02-tests-ci-backup-regression.md) | Tests, CI & Backup-Regressionsanker | 1 | ✅ fertig |
| [SPEC-03](SPEC-03-tenant-scoped-validierung.md) | Tenant-scoped Validierung | 1 | ✅ fertig |
| [SPEC-04](SPEC-04-buchungslogik.md) | Buchungslogik härten | 2 | ✅ fertig |
| [SPEC-05](SPEC-05-nummernkreise.md) | Lückenlose Nummernkreise & Periodenfestschreibung | 2 | ✅ fertig |
| [SPEC-06](SPEC-06-audit-log.md) | Audit-Log aktivieren | 2 | ✅ fertig |
| [SPEC-07](SPEC-07-db-haertung.md) | DB-Härtung (bigint, Indizes, Cache) | 2 | ✅ fertig |
| [SPEC-08](SPEC-08-projekte-kostenstellen.md) | Feature: Projekte, Kostenstellen & Kostenträger | 3 | ✅ fertig |
| [SPEC-09](SPEC-09-ocr-belege.md) | Feature: OCR-Belegerfassung | 3 | 🔲 offen |
| [SPEC-10](SPEC-10-ai-assistent.md) | Feature: AI-Buchungsassistent | 3 | 🔲 offen |
| [SPEC-11A](SPEC-11A-berichte-exporte.md) | Berichte 2.0, BWA, EÜR & manuelle ELSTER-Übergabe | 3 (vorgezogen) | 🔲 offen |
| [SPEC-11B](SPEC-11B-ustva-elster-eric.md) | Zukunft: USt-VA automatisch via ELSTER/ERiC | Zukunft | 🔲 später |
| [SPEC-12](SPEC-12-bankabgleich-import.md) | Bankabgleich: Kontoauszug-Import & Zuordnung | 3 (vor 09/10) | 🔲 offen |
| [SPEC-13](SPEC-13-offene-posten-teilzahlungen.md) | Offene Posten & Teilzahlungen (OPOS) | 3 (Fundament) | ✅ umgesetzt |

Status-Pflege: 🔲 offen → 🔨 in Arbeit → ✅ fertig (bitte beim Abschließen aktualisieren).

### Abhängigkeitskette Zahlungen/Steuer

```
SPEC-13 (Offene Posten & Teilzahlungen – Fundament)
   ├─► SPEC-12 Teil B  (Bankabgleich ordnet Umsätze als Teilzahlungen zu)
   └─► SPEC-11A-EÜR    (Zu-/Abflussprinzip braucht Zahlungsdatum + OP-Zuordnung;
                        gleiche Abhängigkeit bei Ist-Versteuerung der USt-VA)
```
11A-R und SPEC-12 Teil A sind unabhängig von SPEC-13 lieferbar.

---

## Backup-Schutzregeln (verbindlich für ALLE Specs)

Das Backup-Modul (`app/Services/Backup/`, Doku: [../backup-module.md](../backup-module.md)) ist die Datensicherung der Kunden und **darf durch keine Änderung brechen**. So funktioniert es:

- Export = JSON mit Metadaten (`backup_version: '1.0'`, `schema_version` = Hash des DB-Schemas) + Datensätze pro Entity.
- Pro Entity existiert ein **Transformer** (`Services/Backup/Transformers/*`), registriert in `EntityTransformerRegistry`. Transformer arbeiten mit **expliziten Feld-Whitelists**.
- Beziehungen werden über **`public_id` (UUID)** exportiert, nie über numerische IDs. Import mappt via `ImportIdMapping`.
- Export-Queries laufen mit `withoutGlobalScopes()` + manuellem `tenant_id`-Filter und `withTrashed()`.

### Regeln

1. **Neue Tenant-Entity ⇒ Pflichtpaket:** Model mit `BelongsToTenant` + `HasPublicId`, eigener Transformer, Eintrag in `EntityTransformerRegistry` (Reihenfolge beachten: Parents vor Children!), Import-Mapping, Erweiterung des Roundtrip-Tests. Ohne dieses Paket ist die Entity vom Backup ausgeschlossen → Datenverlust beim Restore.
2. **Neue Spalte auf bestehender Entity ⇒ Transformer erweitern** (Export-Whitelist + Import-Seite). Import muss **alte Backups ohne das Feld weiterhin akzeptieren** (Default-Wert setzen, nie `required`).
3. **Spalten nie umbenennen/löschen**, solange Backups im Umlauf sind, die sie enthalten. Wenn unvermeidbar: Import-Kompatibilitätsschicht (altes Feld → neues Feld mappen) und `backup_version` erhöhen.
4. **`public_id` ist heilig:** nie entfernen, nie neu generieren, bei Datenmigrationen erhalten. Ein geändertes `public_id` zerreißt alle Referenzen in bestehenden Backups.
5. `schema_version` ist ein Schema-Hash – **vor** Änderungen an der Import-Validierung prüfen, wie streng der Vergleich ist, damit legitime alte Backups nicht abgewiesen werden.
6. **Queue-Kontext:** Backup-Jobs laufen ohne HTTP-Request → `tenant()` ist null. Neue Job-Logik muss den Tenant explizit setzen/durchreichen (Muster in `ProcessBackupExportJob` ansehen).
7. **Jede Migration ⇒ Backup-Test ausführen:** `sail artisan test --filter=Backup` + (bei größeren Änderungen) manueller Roundtrip: Export bei Tenant A → Import in frischen Tenant → Stichproben vergleichen.
8. Der **Roundtrip-Regressionstest aus SPEC-02** ist der automatische Wächter – er muss in jeder CI grün sein, bevor gemergt wird.

### Schnell-Checkliste vor jedem Merge mit Schema-Änderung

```
[ ] Transformer angepasst (Export + Import)?
[ ] Registry-Eintrag (bei neuer Entity)?
[ ] Alte Backups noch importierbar (Feld optional/Default)?
[ ] test --filter=Backup grün?
[ ] Roundtrip-Test um neue Felder/Entities erweitert?
```
