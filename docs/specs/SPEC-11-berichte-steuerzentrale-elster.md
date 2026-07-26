# SPEC-11 – Berichte 2.0, Steuerzentrale & ELSTER

**Phase:** 3 (vorgezogen, vor SPEC-09/10) · **Priorität:** hoch · **Aufwand:** stufenweise, ca. 10–16 Wochen · **Abhängigkeiten:** SPEC-02 bis SPEC-07, für Projektberichte SPEC-08 · **Status:** 🔲 offen

## Ziel

AT-Book erhält belastbare Finanzberichte und eine Steuerzentrale. Nutzer sollen eine USt-Voranmeldung aus festgeschriebenen Buchungen vorbereiten, prüfen und nach ausdrücklicher Bestätigung elektronisch an die Finanzverwaltung übermitteln können. Danach folgen BWA, EÜR, E-Bilanz/GuV und Anlagenabschreibungen.

```text
Zeitraum → Qualitätsprüfung → amtliche Vorschau → Nutzerbestätigung
         → Zertifikat entsperren → ERiC → Annahme + Ticket + Protokoll
```

**„Mit einem Knopf“ bedeutet:** Sind alle Vorprüfungen grün, löst ein bestätigter Klick die Übermittlung aus. AT-Book sendet nie automatisch, nie aus Entwürfen und nie ohne prüfbare Vorschau.

## Amtliche Leitplanken (Stand 26.07.2026)

1. AT-Book muss als ELSTER-Hersteller/Entwickler registriert werden, Zugriff auf das Entwicklerpaket erhalten und eine Hersteller-ID beantragen. ERiC ist die C-Bibliothek für Plausibilisierung, verschlüsselte Übermittlung und Protokoll: [ELSTER – Entwickler](https://www.elster.de/elsterweb/infoseite/entwickler).
2. Authentifizierte Übermittlung setzt ein elektronisches Zertifikat voraus; das Übertragungsprotokoll ist der Nachweis der USt-VA-Abgabe: [ELSTER – Unternehmer](https://www.elster.de/elsterweb/infoseite/unternehmer).
3. XML-Schemata und Plausibilitätsregeln sind jahresabhängig und kommen aus dem jeweiligen ERiC-Release: [ELSTER – USt-VA-Upload](https://www.elster.de/eportal/helpGlobal?themaGlobal=ustva_upload), [BMF – USt-VA 2026](https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Umsatzsteuer/2025-12-29-vordruckmuster-USt-voranmeldung-2026.html).
4. Anlage EÜR ist eine eigene Gewinnermittlung nach § 4 Abs. 3 EStG, nicht die heutige GuV: [ELSTER – Anlage EÜR](https://www.elster.de/eportal/formulare-leistungen/alleformulare/euer).
5. Bilanz/GuV werden als E-Bilanz mit gültiger Taxonomie übermittelt. Für Wirtschaftsjahre 2026 gilt grundsätzlich Taxonomie 6.9; unverdichtete Kontennachweise sind für nach dem 31.12.2024 beginnende Wirtschaftsjahre relevant: [BMF – Taxonomie 6.9](https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Einkommensteuer/2025-06-10-ebilanz-taxonomien-6-9.html).
6. BWA ist eine interne Auswertung, keine Steueranmeldung. Fristen werden nicht hartcodiert.

Diese Spec ersetzt keine Steuer-/Rechtsberatung. Vor Produktivfreigabe jeder Steuerart sind Review durch eine deutsche Steuerfachperson und amtliche Testfälle Pflicht.

## Ist-Analyse

| Bereich | Befund | Konsequenz |
|---|---|---|
| USt-VA | `taxReport()` gruppiert nur `tax_key` und summiert `tax_amount` | Keine Kennziffern/Sonderfälle; nicht sendefähig |
| Status | Reports schließen Entwürfe nicht aus; Dashboard rechnet anders | Entwürfe könnten Steuerdaten verfälschen |
| Kern | Eager Loading, PHP-Summen und duplizierte Regeln | Langsam und inkonsistent |
| Qualität | Keine zentrale Prüfung auf Mapping-/Steuer-/Entwurfsfehler | Fehler werden zu spät sichtbar |
| Export | Nur JSON; PDF-Button ohne Aktion; Kontobewegungen nur Hinweis | Kein belastbarer Export |
| Frontend | `any`, Inline-Requests | Keine stabilen Verträge |
| Mapping | `tax_codes` ohne jahresabhängige amtliche Zuordnung | Daten reichen nicht für USt-VA |
| EÜR/BWA/AfA | Nicht vorhanden; nur AfA-Aufwandskonten | Eigene Engines/Entities nötig |
| ELSTER | Kein ERiC, Zertifikat oder Übermittlungsstatus | Versand aktuell unmöglich |
| Tests | Nur wenige Storno-Fälle | Golden Masters und Übermittlungstests fehlen |

Vorhanden und wiederzuverwenden: SuSa, GuV, Bilanz, Journal, Kontobewegungen, SPEC-08-Reports, Festschreibung, Generalumkehr, Audit-Log und `ReportsStornoTest`.

## Stufe A – Reports-Core, Datenqualität, Exporte und BWA (2–3 Wochen)

### A1. Zentraler Kern

- Services unter `app/Modules/Accounting/Reports/`: `ReportPeriod`, `ReportQueryService`, je Report eine Klasse, `ReportQualityService`, `ReportExportService`.
- `ReportsController` wird dünner HTTP-Adapter.
- SQL-Aggregation, tenant-scoped, ausschließlich Integer-Cents.
- Einheitlicher Vertrag: Typ, Basis, Zeitraum, Erstellungszeit, Währung, Daten, Summen, Qualitätsstatus.

### A2. Status, Storno und Qualität

- Standard: nur `posted` + `cancelled`; Original und Generalumkehr neutralisieren sich.
- Entwürfe nur mit `basis=preview`, klar markiert als nicht abgabefähig.
- Steuer-/Behördenreports akzeptieren nur `basis=posted`.
- Festgeschriebene Periode aus SPEC-05 ist Voraussetzung des finalen Steuer-Snapshots; offene Entwürfe blockieren.
- Bilanz bis Stichtag; GuV/BWA für Periode; SuSa mit Eröffnung, Bewegung und Schluss.
- Qualitätschecks: Soll=Haben, fehlende Kontenbezüge, ungemappte Konten/Steuerschlüssel, widersprüchliche Steuerdaten, Entwürfe/Sperre, Firmen-/Steuerdaten, Zertifikat. Jede Meldung hat Code, Schweregrad, Anzahl und Drill-down.

### A3. BWA, Export und UI

- Monatswerte, kumuliert, Vorjahr und Abweichung in Betrag/Prozent.
- Umsätze, Einsatz, Rohertrag, Personal, Raum, Versicherungen, Kfz, Werbung/Reisen, AfA, sonstige Kosten, Betriebsergebnis.
- Drill-down bis Journalzeile; tenant- und versionsbezogenes Mapping.
- Echte PDF/CSV/XLSX-Endpunkte; große Exporte als Job mit signiertem Download.
- Kontobewegungen mit Kontoauswahl, Eröffnungs-, laufendem und Schlusssaldo.
- Typisierter `reportService.ts`, React Query, kein neues `any`.
- `/{tenant}/tax-center` für Steuerprozesse; `/{tenant}/reports` bleibt Managementbereich.

## Stufe B – USt-VA via ELSTER (3–5 Wochen nach ELSTER-Zugang)

### B1. Voraussetzungen und Mapping

Ohne Herstellerregistrierung, Hersteller-ID, ERiC-Plattform-/Lizenzprüfung und bestandene ELSTER-Testfälle gibt es nur „vorbereiten/exportieren“, niemals „ans Finanzamt senden“.

Neue tenant-scoped Entity `report_account_mappings`:

```text
id, tenant_id, public_id
report_type             # bwa | ustva | euer | ebilanz
form_version            # z.B. ustva-2026
source_type, source_public_id
target_code, value_type, sign
valid_from, valid_until, timestamps
UNIQUE Tenant + Report/Form-Version + Quelle + Ziel
```

- Versionierte SKR03-Standardmappings; individuelle Konten müssen zuordenbar sein.
- Kennziffern/Rundung aus ERiC-Doku, abgesichert durch Golden Masters.
- Unbekannte Sachverhalte blockieren.
- MVP: inländische Standardsätze, Vorsteuer, Zahllast/Erstattung, negative Berichtigung, Nullmeldung. Sonderfälle erst nach vollständigem Modell/Test.

### B2. Unveränderlicher Steuer-Snapshot

Neue Entity `tax_filings`:

```text
id, tenant_id, public_id, filing_type
period_start, period_end, tax_year, form_version, sequence_no
correction_for_id nullable
status                   # draft|validated|transmitting|accepted|rejected|failed
source_hash, calculated_values jsonb
payload_encrypted, validation_result nullable
eric_version, transfer_ticket nullable
submitted_by, submitted_at nullable
response_code, response_message nullable
protocol_path, protocol_sha256 nullable
timestamps
```

- `tax_filing_events` ist append-only.
- Nach `validated` ist der Snapshot unveränderlich. Buchungsänderung verändert `source_hash` und erzwingt Vorschau/Korrektur.
- Nur positive ERiC-Rückmeldung setzt `accepted`; eigenes HTTP 200/Queueing genügt nicht.
- Idempotency-Key und Sequenz verhindern Doppelsendung.
- Angenommene Meldungen werden nie überschrieben; erneute Abgabe ist referenzierte Korrektur.

### B3. ERiC, Zertifikat und Bestätigung

- `ElsterGateway` mit `validate()`, `submit()`, `renderProtocol()`; Fake für Tests, ERiC-Adapter für Test/Produktion.
- ERiC als versionierter nativer Adapter/Sidecar; Tenant, Filing, Formularversion und Modus explizit.
- Plausibilitäts-, Ablehnungs-, Netzwerk- und interne Fehler getrennt; Originalcodes speichern.
- Produktivmodus bis Hersteller-ID, Tests und Security-Review global aus.
- `tax_certificates`: Fingerprint, Gültigkeit, KMS-/Envelope-verschlüsselter privater Pfad.
- PIN nicht speichern/loggen/serialisieren; nur im Speicher des unmittelbaren Aufrufs. Asynchron nur mit einmaligem Secret-Handoff und kurzer TTL, nie über DB-Queue.
- Vor Submit zeigt AT-Book Firma, Steuernummer, Finanzamt, Zeitraum, Version, Kennziffern, Zahllast/Erstattung, Qualität, Meldungsart und Prüferklärung.
- Nach Annahme: echter Status, Transferticket und Protokoll-PDF.

## Stufe C – EÜR (3–5 Wochen)

- Eigener `EuerReport`, kein Alias für GuV.
- Zu-/Abfluss aus Zahlungen, Bank/Kasse und verknüpften offenen Posten; Rechnungsdatum genügt nicht.
- Versioniertes Formularmapping und auditierte `tax_adjustments` für private/nicht abziehbare Sachverhalte; keine Änderung festgeschriebener Buchungen.
- Ist-/Soll-Versteuerung, Kleinunternehmerstatus, Wirtschaftsjahr, Rechtsform und Gewinnermittlungsart in Settings.
- Erst Export/Plausibilisierung; produktive Übermittlung nach Fachreview und amtlichen Tests.
- Nicht unterstützte Gesellschafts-/Sonderfälle blockieren.

## Stufe D – Anlagen und AfA (3–4 Wochen)

- `fixed_assets`: Anschaffung, Kosten, Restwert, Nutzungsdauer/Methode, Konten, Abgang, Status, Beleg.
- `depreciation_schedules`: Anlage, Periode, Betrag, Status, Journalbezug, Buchungszeit.
- Zunächst lineare monatsgenaue AfA; weitere Methoden/GWG jahresabhängig.
- AfA-Läufe erzeugen Entwürfe; Nutzer prüft, bucht, schreibt fest.
- Unique pro Anlage/Periode plus Lock verhindert Doppelbuchung.
- Anlagenverzeichnis, Vorschau und Buchwerte als PDF/XLSX; Grundlage für AVEÜR/E-Bilanz.

## Stufe E – E-Bilanz/GuV (4–6 Wochen)

- Versionierte Taxonomie-Engine statt einfacher GuV.
- Konto → Taxonomieposition, Mussfelder, NIL-Werte, GCD-/GAAP-Daten, Kontennachweise, Anlagenspiegel.
- Eigene ELSTER-Datenart; niemals bisherigen `profit-loss`-JSON senden.
- Nur definierte Rechtsformen/Bilanzarten/Jahre unterstützen; andere blockieren.

## API-Skizze

```text
GET  /api/reports/{type}?from_date=&to_date=&basis=posted
POST /api/reports/{type}/exports
GET  /api/report-exports/{public_id}
GET  /api/reports/quality?from_date=&to_date=&report_type=

GET/PUT /api/tax/settings
GET/POST /api/tax/filings
POST /api/tax/filings/{public_id}/validate
POST /api/tax/filings/{public_id}/submit
POST /api/tax/filings/{public_id}/corrections
GET  /api/tax/filings/{public_id}/protocol
POST/GET/DELETE /api/tax/certificates/...

CRUD /api/fixed-assets
GET  /api/fixed-assets/depreciation-preview?year=
POST /api/fixed-assets/depreciation-runs
```

Neue Routen nutzen `public_id`, `auth:api`, `SetTenantFromUser`, `onboarding.complete` und tenant-scoped Binding/Validierung.

## Settings, Rollen, Audit und Sicherheit

- Settings: Finanzamt, strukturierte/bundeslandabhängig validierte Steuernummer, USt-VA-Rhythmus, Dauerfristverlängerung, Gewinnermittlung, Wirtschaftsjahr, Ist-/Soll-Versteuerung, Modul-Flag.
- Permissions: `reports.view/export`, `tax.view/prepare/submit/manage_certificate`, `assets.view/manage/post_depreciation`. Owner alle; Buchhalter View/Prepare/Submit; Zertifikat nur bewusst; Manager Managementreports; Kassierer keine Steuerdaten.
- Audit-Events für Export, Filing-Lebenszyklus/Korrektur, Zertifikatswechsel, Anlage und AfA-Buchung.
- Audit/Logs enthalten keine Zertifikatsbytes, PIN oder vollständiges Steuer-XML.
- Payload/Protokoll verschlüsseln; Downloads autorisieren/signieren; Steuernummern maskieren.
- Replay-, Rate-Limit- und Idempotency-Schutz; kein Drittanbieter-Analytics im Steuerbereich.
- Angenommene Nachweise nicht normal löschbar; Aufbewahrungskonzept vor Launch.

## Backup-Impact ⚠️

- Neue Tenant-Entities: `BelongsToTenant`, `HasPublicId`, Transformer, Registry, Roundtrip-Tests.
- Neue Settings-Felder optional im Transformer; alte Backups bleiben importierbar.
- Zertifikate/PINs nicht exportieren; nach Restore neuer Upload.
- Protokolle verschlüsselt im Datei-Backup oder dauerhafter tenant-isolierter Ablage. Restore ohne Nachweis ist nicht akzeptabel.
- Import darf nie erneut senden oder Send-Jobs rekonstruieren.

## Teststrategie

- Golden Master mit Erlös, Aufwand, Vor-/USt, Zahlung, Storno, Eröffnung, Entwurf.
- Statusmatrix, Bilanzgleichheit, SuSa Soll=Haben, zwei Tenants, Query-Budget/N+1, Exporte.
- Amtliche ERiC-Fälle je Version; Standardsätze, Nullmeldung, Berichtigung, Rundung, Erstattung.
- Ungemappte/widersprüchliche Daten und Entwürfe blockieren.
- Source-Hash, unveränderlicher Snapshot, Fake-Gateway für Annahme/Ablehnung/Timeout/Retry.
- Doppelklick sendet nicht doppelt; PIN nie in DB/Queue/Logs; Restore sendet nichts.
- EÜR: Zahlung in anderem Jahr, Teilzahlung, Storno, Rückerstattung, Einlage/Entnahme.
- AfA: Monate, Schaltjahr, Abgang, Rundungsrest, Idempotenz.
- Formular-/Taxonomieversion aus Wirtschaftsjahr, nicht aktuellem Datum.

## Akzeptanzkriterien

### Gate A

- [ ] Zentraler Query-/Status-Kern; `basis=posted` Standard
- [ ] Entwurfsvorschau klar markiert
- [ ] PDF/CSV/XLSX und Kontobewegungen funktionieren
- [ ] BWA mit Monat, kumuliert, Vorjahr und Drill-down
- [ ] Golden-Master-, Storno-, Tenant- und Performance-Tests grün

### Gate B

- [ ] Herstellerzugang/-ID und bestandene ERiC-Testfälle
- [ ] Unterstützte Sachverhalte/Formularjahre dokumentiert
- [ ] Qualität, Mapping und ERiC-Plausibilisierung grün
- [ ] Nutzer bestätigt vollständige Meldung; PIN nicht persistiert
- [ ] Nur Annahme setzt `accepted`; Ticket/Protokoll gespeichert
- [ ] Korrekturen unveränderlich historisiert
- [ ] Rollen-, Tenant-, Idempotency-, Fehler- und Backup-Tests grün

### Gate C–E

- [ ] EÜR basiert auf Zahlungs-/Steuerdaten, nicht umbenannter GuV
- [ ] Anlagen/AfA nachvollziehbar, idempotent und explizit gebucht
- [ ] E-Bilanz nutzt Wirtschaftsjahr-Taxonomie und ERiC-Prüfung
- [ ] Jede Steuerart besitzt amtliche Tests und fachliche Freigabe

## Nicht-Ziele des ersten Releases

Keine automatische Abgabe, keine Steuerberatungs-Garantie, keine EÜR aus GuV-Salden, kein Versand einfacher GuV, nicht alle USt-Sonderfälle, kein selbst erfundenes XML und keine Browser-Automation.

## Definition of Done

- [ ] Amtliche Versionen/Support-Matrix dokumentiert und steuerfachlich geprüft
- [ ] ERiC-Test/Produktion strikt getrennt
- [ ] Security-Review für Zertifikat, PIN, Payload, Protokoll
- [ ] Monitoring und Runbook für Ablehnung, Update, Zertifikatswechsel, Retry
- [ ] Backup-Roundtrip inklusive Protokoll-Ablage verifiziert