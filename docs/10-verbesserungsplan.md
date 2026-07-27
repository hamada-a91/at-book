# 10 – Masterplan: Verbesserungen & neue Features

**Stand:** 16.07.2026 · Basiert auf der Analyse in [08-kritische-punkte.md](08-kritische-punkte.md) und der Roadmap in [09-roadmap.md](09-roadmap.md).
Detaillierte, umsetzbare Spezifikationen liegen in **[specs/](specs/README.md)** – eine Spec pro Arbeitspaket.

## Leitprinzipien

1. **Erst härten, dann bauen:** Sicherheit → Korrektheit → Qualität → neue Features.
2. **Das Backup-Modul darf nie brechen.** Es ist die Datensicherung der Kunden. Deshalb wird als allererstes technisches Sicherheitsnetz ein **Backup-Roundtrip-Regressionstest** etabliert (SPEC-02), *bevor* Schema-Änderungen passieren. Verbindliche Schutzregeln: [specs/README.md → Backup-Schutzregeln](specs/README.md#backup-schutzregeln).
3. **Jede Phase endet grün:** Tests laufen, App startet, Export→Import-Roundtrip funktioniert.
4. Kleine, einzeln mergebare Pakete – keine Big-Bang-Umbauten.

## Phasenplan

### Phase 0 – Sofortmaßnahmen Sicherheit (≈ 1 Tag)
> Kein Schema-Change, kein Backup-Risiko.

| Spec | Inhalt |
|---|---|
| [SPEC-01](specs/SPEC-01-sicherheits-hotfixes.md) | `force-schema-fix`-Route entfernen, `role:admin` auf `/api/admin/*`, APP_KEY-Rotation + `APP_DEBUG=false`, Token-Logging im Frontend entfernen |

### Phase 1 – Sicherheitsnetz & Isolation (≈ 3–5 Tage)

| Spec | Inhalt |
|---|---|
| [SPEC-02](specs/SPEC-02-tests-ci-backup-regression.md) | **Backup-Roundtrip-Test als Regressionsanker**, Kerntests (Isolation, Soll=Haben, GoBD), CI-Pipeline (Pint + PHPUnit + Build) |
| [SPEC-03](specs/SPEC-03-tenant-scoped-validierung.md) | Zentrale `TenantExists`-Rule, alle `exists:`-Validierungen tenant-scopen, Isolationstests |

### Phase 2 – Fachliche Korrektheit Buchhaltung (≈ 1–2 Wochen)

| Spec | Inhalt |
|---|---|
| [SPEC-04](specs/SPEC-04-buchungslogik.md) | Rechnungs-/Beleg-Buchung in Services + `DB::transaction`, Festschreibung (`locked_at`), USt-Konten über `tax_codes` statt hartcodiert |
| [SPEC-05](specs/SPEC-05-nummernkreise.md) | Tabelle `number_sequences` mit Sperre (`FOR UPDATE`) – lückenlose, race-freie Nummern für Rechnungen/Belege · **plus Periodenfestschreibung** (Monatsabschluss wie Lexware: Entwürfe bis Datum X festschreiben, Erfassungssperre, GoBD-Frist-Hinweis) |
| [SPEC-06](specs/SPEC-06-audit-log.md) | Audit-Log aktivieren (Observer für JournalEntry/Invoice/Beleg) |
| [SPEC-07](specs/SPEC-07-db-haertung.md) | Betragsspalten auf `bigint`, `tenant_id`-Indizes, Onboarding-Cache |

### Phase 3 – Neue Features (nach Abschluss Phase 0–2)

| Spec | Inhalt | Abhängig von |
|---|---|---|
| [SPEC-08](specs/SPEC-08-projekte-kostenstellen.md) | **Projekte mit Kostenstellen (KOST1) & Kostenträgern (KOST2)** als Modul `Modules/Projects`, Dimensionen an Buchungszeilen, Reports | SPEC-03, 04, 07 |
| [SPEC-11A](specs/SPEC-11A-berichte-exporte.md) | **Berichte 2.0, BWA, EÜR & manuelle ELSTER-Übergabe**: zuerst SuSa, GuV, Bilanz, BWA, Journal, Kontobewegungen und Exporte; danach EÜR auf Zu-/Abflussbasis | SPEC-02 bis 07; Projektberichte SPEC-08 |
| [SPEC-11B](specs/SPEC-11B-ustva-elster-eric.md) | **Zukunft: USt-VA automatisch via ELSTER/ERiC** mit Zertifikat, Annahmeprotokoll und Korrekturen | vollständige SPEC-11A + ELSTER-Zugang/Hersteller-ID |
| [SPEC-13](specs/SPEC-13-offene-posten-teilzahlungen.md) | **Offene Posten & Teilzahlungen (OPOS)**: `amount_paid` + Zahlungs-Ledger `payments`, Teilzahlung/Skonto, OP-Report. Fundament für Bankabgleich & EÜR | SPEC-04, 05, 06 |
| [SPEC-12](specs/SPEC-12-bankabgleich-import.md) | **Bankabgleich**: Kontoauszug-CSV-Import + Zuordnung zu Belegen/Rechnungen/Kategorien (erzeugt Zahlungsbuchungen), Auto-Match & Lern-Regeln. Vorgezogen vor 09/10 | SPEC-04, 05, 06, 08; **Teil B: SPEC-13** |
| [SPEC-09](specs/SPEC-09-ocr-belege.md) | **OCR-Belegerfassung**: ZUGFeRD/XRechnung zuerst, dann Vision-LLM, Buchungsvorschlag mit User-Bestätigung | SPEC-04, 05, 06 |
| [SPEC-10](specs/SPEC-10-ai-assistent.md) | **AI-Buchungsassistent**: Kontierungsvorschläge, später Chat-Auswertungen | SPEC-09 (teilt Infrastruktur) |

## Abhängigkeitsgraph

```
SPEC-01 (Sicherheit) ──────────────────────────────┐
SPEC-02 (Tests/CI/Backup-Anker) ──► alle folgenden │
SPEC-03 (TenantExists) ──► SPEC-08                 │
SPEC-04 (Buchungslogik) ──► SPEC-05 ──► SPEC-09    │
SPEC-06 (Audit) ──► SPEC-09                        │
SPEC-07 (DB) ──► SPEC-08                           │
SPEC-02…08 ──► SPEC-11A-R (Reports/BWA/Exporte) ──► SPEC-11B (ELSTER, später)
SPEC-13 (Offene Posten/Teilzahlungen) ──┬─► SPEC-12 Teil B (Bankabgleich)
                                        └─► SPEC-11A-EÜR (Zu-/Abfluss, Ist-Versteuerung)
SPEC-09 (OCR) ──► SPEC-10 (AI)                     ▼
                                            Produktion sicher
```

**Zahlungs-/Steuer-Kette (Details):** `SPEC-13` (Offene-Posten-Verwaltung mit Zahlungs-Ledger) ist das Fundament. Darauf bauen `SPEC-12 Teil B` (ein Bankumsatz wird als – ggf. teilweise – Zahlung zugeordnet) und `SPEC-11A-EÜR` (die EÜR datiert nach Zu-/Abfluss und braucht die Zahlungsdaten; identisch bei Ist-Versteuerung der USt-VA). `SPEC-11A-R` und `SPEC-12 Teil A` (reiner CSV-Import) laufen unabhängig davon.

## Definition of Done (gilt für jede Spec)

- [ ] Alle Akzeptanzkriterien der Spec erfüllt
- [ ] Feature-Tests geschrieben und grün (`sail artisan test`)
- [ ] **Backup-Roundtrip-Test grün** (`sail artisan test --filter=Backup`)
- [ ] Bei Schema-Änderungen: Transformer geprüft/erweitert (siehe Backup-Schutzregeln)
- [ ] `vendor/bin/pint` sauber
- [ ] Doku in `docs/` aktualisiert (mind. 04/05, bei Bedarf CLAUDE.md)
- [ ] Punkt in [08-kritische-punkte.md](08-kritische-punkte.md) als erledigt markiert
