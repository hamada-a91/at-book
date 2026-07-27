# SPEC-11A – Berichte 2.0, BWA, EÜR & manuelle ELSTER-Übergabe

**Phase:** 3 (vorgezogen, vor SPEC-09/10) · **Priorität:** hoch · **Aufwand:** stufenweise: Reports ca. 3–5 Wochen, EÜR zusätzlich ca. 3–5 Wochen · **Abhängigkeiten:** 11A-R: SPEC-02 bis SPEC-07, Projektberichte SPEC-08. **11A-EÜR zusätzlich: SPEC-13 (Offene Posten/Zahlungs-Ledger) und SPEC-12 (Bankumsätze)** – die EÜR arbeitet auf Zu-/Abflussbasis und braucht Zahlungsdatum + eindeutige OP-Zuordnung (siehe 11A.EÜR). · **Status:** 🔲 offen

> **Abhängigkeits-Hinweis:** **11A-R** (SuSa/GuV/Bilanz/BWA/Exporte/USt-VA-Eingabehilfe) ist ohne SPEC-13/12 lieferbar. **11A-EÜR** setzt SPEC-13 (Zahlungs-Ledger) und SPEC-12 (Bankbewegungen) voraus, da das Zu-/Abflussprinzip Zahlungsdaten benötigt. Für **Ist-Versteuerung** (USt auf Zahlungsdatum) gilt dieselbe Abhängigkeit – als Tenant-Einstellung `taxation_method = soll|ist` vorsehen.

## Ziel

Das vorhandene Berichte-Modul wird fachlich vereinheitlicht, schneller, nachvollziehbar und vollständig exportierbar. AT-Book erstellt SuSa, GuV, Bilanz, BWA, Journal, Kontobewegungen und eine USt-VA-Eingabehilfe auf Knopfdruck. In einer zweiten, unabhängig lieferbaren Stufe kommt eine fachlich eigenständige EÜR mit manueller ELSTER-Eingabehilfe hinzu.

Die Lieferstufen sind bewusst getrennt:

1. **11A-R:** Reports-Core, BWA, Downloads und USt-VA-Eingabehilfe.
2. **11A-EÜR:** EÜR auf Zu-/Abflussbasis, EÜR-Export und manuelle Übernahme in Mein ELSTER.

11A-R darf produktiv gehen, bevor 11A-EÜR abgeschlossen ist.

Die Abgabe bleibt in diesem Teil bewusst manuell:

```text
Zeitraum wählen → Qualität prüfen → Bericht erzeugen → PDF/CSV/XLSX herunterladen
                                               └→ USt-VA-Kennziffern in Mein ELSTER übertragen
```

AT-Book sendet in SPEC-11A keine Daten an das Finanzamt, verwaltet kein ELSTER-Zertifikat und zeigt niemals „erfolgreich abgegeben“ an.

## Abgrenzung: manuell in Mein ELSTER

Eine normale PDF-, CSV- oder XLSX-Datei ist keine elektronische Steueranmeldung. Der sofort umsetzbare Standard ist deshalb ein **ELSTER-Übertragungsbogen**: amtliche Kennziffer, Betrag, Herleitung und Prüfstatus werden so angezeigt, dass der Nutzer sie kontrolliert in Mein ELSTER eintragen kann.

Optional darf zusätzlich eine USt-VA-XML-Datei angeboten werden, die der Nutzer selbst in Mein ELSTER hochlädt. Das Feature bleibt hinter `tax_xml_export_enabled=false`, bis das XML gegen das amtliche Schema der jeweiligen Jahresversion und den echten Mein-ELSTER-Upload getestet wurde. Kein selbst erfundenes oder nur syntaktisch ähnliches XML.

Amtliche Referenzen: [ELSTER – USt-VA-XML-Upload](https://www.elster.de/eportal/helpGlobal?themaGlobal=ustva_upload) und [BMF – USt-VA-Vordrucke 2026](https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Umsatzsteuer/2025-12-29-vordruckmuster-USt-voranmeldung-2026.html).

## Ist-Analyse

| Bereich | Ist-Zustand | Verbesserung |
|---|---|---|
| Report-Kern | Berechnungen liegen gesammelt im `ReportsController` und summieren teils in PHP | Getestete Report-Services und SQL-Aggregation |
| Status | Reports und Dashboard behandeln Entwürfe unterschiedlich | Eine verbindliche Status-/Storno-Regel |
| SuSa | Nur Periodenbewegung und einfacher Saldo | Eröffnung, Soll/Haben, Periode und Schluss |
| GuV | Einfache Kontenliste | Gliederung, Monat/Jahr, Vorjahresvergleich, Drill-down |
| Bilanz | Basis vorhanden | Bilanzgleichheit, Stichtag, Gliederung und Drill-down |
| BWA | Nicht vorhanden | Tagesaktuelle Monats-/Jahresauswertung |
| USt-Bericht | Gruppiert nur `tax_key`/`tax_amount` | Kennziffern, Vorsteuer/USt, Zahllast und Herleitung |
| Export | JSON; PDF-Button ohne Funktion | Echte PDF-, CSV- und XLSX-Downloads |
| Kontobewegungen | UI zeigt nur einen Hinweis | Kontoauswahl und laufender Saldo |
| Frontend | `any` und Inline-Requests | Typisierter Service und React Query |
| Tests | Vor allem Storno-Regression für SuSa/GuV | Golden Masters, Isolation, Export und Performance |

## 11A.1 Zentraler Report-Kern

Neue Klassen unter `app/Modules/Accounting/Reports/`:

- `ReportPeriod`
- `ReportQueryService`
- `ReportQualityService`
- `TrialBalanceReport`
- `ProfitLossReport`
- `BalanceSheetReport`
- `BwaReport`
- `JournalReport`
- `AccountMovementsReport`
- `VatReport`
- `ReportExportService`

`ReportsController` bleibt dünner HTTP-Adapter. Alle Aggregationen sind tenant-scoped, nutzen Integer-Cents und möglichst SQL statt vollständige Eloquent-Collections.

Gemeinsamer API-Vertrag:

```json
{
  "report_type": "profit_loss",
  "basis": "posted",
  "period": {"from": "2026-01-01", "to": "2026-07-31"},
  "generated_at": "2026-07-26T12:00:00Z",
  "currency": "EUR",
  "data": {},
  "totals": {},
  "quality": {"status": "ok", "warnings": [], "blocking_errors": []}
}
```

## 11A.2 Verbindliche Buchungsbasis

- Standard für Berichte: `posted` + `cancelled`; Original und Generalumkehr neutralisieren sich.
- Entwürfe nur mit `basis=preview`; UI und Export tragen deutlich „inkl. Entwürfe – nicht zur Abgabe geeignet“.
- USt-VA-Eingabehilfe und optionales XML akzeptieren ausschließlich `basis=posted`.
- Für einen endgültigen Steuerexport muss die Periode gemäß SPEC-05 festgeschrieben sein. Offene Entwürfe im Zeitraum blockieren.
- Bilanz rechnet bis Stichtag; GuV/BWA für die Periode; SuSa trennt Eröffnung, Periodenbewegung und Schluss.

## 11A.3 Datenqualität

`ReportQualityService` prüft mindestens:

- Soll = Haben je Buchung und insgesamt,
- fehlende Kontenbezüge,
- ungemappte BWA-/USt-Konten und Steuerschlüssel,
- Steuerbetrag ohne Steuerart oder widersprüchlichen Satz,
- Entwürfe und Periodensperre,
- fehlende Firmen-/Steuerdaten,
- Bilanzdifferenz,
- Zeiträume mit `from > to` oder unzulässiger Zukunft.

Jeder Befund liefert `code`, `severity`, `message`, `affected_count` und einen Drill-down. Blockierende Fehler verhindern nur den amtlichen Steuerexport, nicht die normale Berichtsvorschau.

## 11A.4 Fachliche Anforderungen je Bericht

### SuSa

- Kontocode/-name, Eröffnungssaldo, Perioden-Soll, Perioden-Haben, Schluss-Soll/-Haben.
- Summenkontrolle Soll = Haben.
- Optional Nullkonten anzeigen; Sortierung nach Kontocode; Drill-down.

### GuV

- Erlöse und Aufwendungen mit fachlichen Gruppen, Zwischensummen und Ergebnis.
- Einzelmonat, Zeitraum, kumuliertes Jahr und Vorjahresvergleich.
- Keine `abs()`-Darstellung, die ungewöhnliche Vorzeichen versteckt; Soll-/Habensaldo und Warnung nachvollziehbar.

### Bilanz

- Aktiva/Passiva nach Stichtag, gegliedert nach Kategorien.
- Debitoren-/Kreditorenaggregation bleibt nachvollziehbar auflösbar.
- Aktiva = Passiva ist Qualitätskriterium; Differenz wird nicht als Gewinn „erzwungen“.

### BWA

- Monatswerte, kumuliertes Jahr, Vorjahr und Abweichung in Betrag/Prozent.
- Mindestens Umsätze, Waren-/Materialeinsatz, Rohertrag, Personal, Raum, Versicherungen/Beiträge, Kfz, Werbung/Reisen, Abschreibungen, sonstige Kosten und Betriebsergebnis.
- Tenant- und versionsbezogenes Mapping; nicht nur freies `accounts.category`.
- BWA ist eine Managementauswertung, keine Steueranmeldung.

### Journal und Kontobewegungen

- Journal mit Datum, Beleg-/Buchungsnummer, Text, Konto, Soll/Haben, Betrag und Status.
- Kontobewegungen mit Kontoauswahl, Eröffnung, laufendem Saldo, Schluss und direktem Buchungslink.
- Große Datenmengen paginieren; vollständigen Export als Hintergrundjob.

### USt-VA-Eingabehilfe

- Amtliche Kennziffern der gewählten Formularversion, Betrag und Buchungsherleitung.
- Umsatzsteuer und Vorsteuer getrennt; Zahllast oder Erstattungsanspruch.
- MVP: inländische steuerpflichtige Umsätze zu unterstützten Standardsätzen, abziehbare Vorsteuer, negative Berichtigung und Nullmeldung.
- Reverse Charge, innergemeinschaftliche Fälle und sonstige Sonderfälle blockieren, solange Datenmodell und Golden-Master-Test fehlen.
- Formular-/Mapping-Version richtet sich nach Meldezeitraum, nicht nach aktuellem Datum.
- PDF „ELSTER-Übertragungsbogen“ und CSV; XML nur nach dem oben beschriebenen Release-Gate.

## 11A.5 Mapping und Datenmodell

Neue tenant-scoped Entity `report_account_mappings`:

```text
id, tenant_id, public_id
report_type             # bwa | ustva | euer
form_version            # z.B. bwa-v1 oder ustva-2026
source_type             # account | tax_code
source_public_id
target_code             # BWA-Zeile oder amtliche Kennziffer
value_type               # base_amount | tax_amount | balance | debit | credit
sign                     # 1 | -1
valid_from, valid_until
timestamps
UNIQUE Tenant + Report/Form-Version + Quelle + Ziel
```

Neue Entity `report_exports` für große/erneut abrufbare Exporte:

```text
id, tenant_id, public_id, report_type, format
filters jsonb, basis, status
storage_path nullable, sha256 nullable
generated_by, generated_at, expires_at
error_code nullable, timestamps
```

Standardmappings für SKR03 werden versioniert bereitgestellt und pro Tenant anpassbar kopiert. Ungemappte aktive Konten erscheinen in einer Mapping-Prüfliste.

## 11A.6 API und Frontend

```text
GET  /api/reports/{type}?from_date=&to_date=&basis=posted
GET  /api/reports/{type}/drilldown?group=&account_id=&...
GET  /api/reports/quality?report_type=&from_date=&to_date=
POST /api/reports/{type}/exports              # pdf|csv|xlsx|elster_xml
GET  /api/report-exports/{public_id}
GET  /api/report-exports/{public_id}/download
GET/PUT /api/report-mappings/{report_type}
```

- Neue typisierte `resources/js/services/reportService.ts`.
- React Query für Vorschau/Exportstatus.
- Datumspresets: Monat, Quartal, Jahr, Vorjahr, frei.
- Report-Dialog wird durch eine volle, druckbare Detailseite ersetzt.
- Download-Buttons zeigen nur tatsächlich unterstützte Formate.
- USt-Seite erklärt klar: „Noch nicht an das Finanzamt übermittelt“.

## 11A.7 Zweite Lieferstufe: EÜR und manuelle ELSTER-Übergabe

Die EÜR ist kein umbenannter GuV-Report. `EuerReport` arbeitet grundsätzlich auf Zu-/Abflussbasis und verwendet Zahlungsdatum, Bank-/Kassenbewegung und eindeutig verknüpfte offene Posten. Rechnungs- oder Buchungsdatum allein genügt nicht.

### Voraussetzungen und Regeln

- `company_settings.profit_determination_method = euer` und gepflegtes Wirtschaftsjahr.
- Rechnungen, Belege und Zahlungen müssen eindeutig verknüpft sein. Ungeklärte, doppelte oder nur teilweise zugeordnete Zahlungsflüsse erscheinen als blockierende Befunde.
- Teilzahlungen, Rückerstattungen und Zahlungen über den Jahreswechsel werden nach Zahlungsdatum berücksichtigt.
- Steuerliche Korrekturen verändern keine festgeschriebenen Buchungen. Dafür dient eine neue, auditierte tenant-scoped Entity `tax_adjustments` mit Typ, Betrag, Steuerjahr, Begründung und optionalem Buchungs-/Belegbezug.
- EÜR-Felder werden über `report_account_mappings` mit `report_type=euer` und jahresabhängiger `form_version` zugeordnet.
- Nicht unterstützte Sonderfälle werden nicht geschätzt, sondern blockieren den Status „bereit zur Übertragung“.

### Anlagen und AVEÜR

Wenn abschreibungsfähige Anlagen vorhanden sind, gehört die AVEÜR fachlich zur EÜR. Solange AT-Book noch keine Anlagenbuchhaltung besitzt, gilt:

- EÜR-Vorschau und übrige Felder dürfen erzeugt werden.
- AT-Book markiert die EÜR als **unvollständig**, sobald Anlagevermögen/AfA relevant ist und kein geprüftes Anlagenverzeichnis vorliegt.
- Ein manuell erfasster AfA-Gesamtbetrag allein darf den AVEÜR-Blocker nicht verdecken.
- Anlagenbuchhaltung, automatische AfA und AVEÜR-Datensatz erhalten später eine eigene Spec; sie blockieren nicht 11A-R.

### Ausgabe und Status

- EÜR-Vorschau mit amtlicher Feld-/Zeilenzuordnung, Betrag und Herleitung bis zu Zahlung/Buchung.
- PDF „EÜR-Übertragungsbogen“ und CSV/XLSX-Arbeitsdatei.
- Status `preliminary`, `incomplete` oder `ready_for_manual_transfer`; niemals `submitted`.
- Optionales EÜR-XML nur nach amtlichem Schema-, Plausibilitäts- und echtem Mein-ELSTER-Upload-Test; separates Feature-Flag, standardmäßig aus.
- UI erklärt ausdrücklich, welche Werte noch manuell in Mein ELSTER ergänzt bzw. übertragen werden müssen.

## Rollen, Audit und Backup

Permissions: `reports.view`, `reports.export`, `report_mappings.manage`, `tax_adjustments.manage`. Owner/Buchhalter erhalten View/Export; Mapping-Verwaltung nur Owner bzw. bewusst berechtigte Buchhalter.

Audit-Events: `report_export_requested`, `report_exported`, `report_mapping_changed`, `vat_transfer_sheet_generated`, `vat_xml_exported`, `euer_transfer_sheet_generated`, `tax_adjustment_created/updated/deleted`. Keine vollständigen Steuerdaten im Audit-Log.

`report_account_mappings`, `report_exports` und `tax_adjustments` erhalten `BelongsToTenant`, `HasPublicId`, Backup-Transformer und Roundtrip-Tests. Neue EÜR-/Gewinnermittlungsfelder in `company_settings` werden optional in den bestehenden Transformer aufgenommen. Abgelaufene Exportdateien dürfen fehlen; Mappingdaten dürfen nicht fehlen. Ein Export löst nie eine Übermittlung aus.

## Tests

- Golden Master mit Erlös, Aufwand, Vor-/USt, Storno, Eröffnung und Entwurf.
- Statusmatrix für `draft/posted/cancelled`.
- Bilanzgleichheit, SuSa Soll=Haben und korrekte Eröffnungs-/Schlusswerte.
- Zwei Tenants mit gleichen Kontocodes.
- USt-Kennziffern, Rundung, Nullmeldung, Erstattung und blockierte Sonderfälle.
- PDF/CSV/XLSX: MIME-Type, Dateiname, Inhalt, Berechtigung.
- Optionales XML: XSD-/Jahresversion und erfolgreicher Test-Upload in Mein ELSTER.
- EÜR: Rechnung und Zahlung in unterschiedlichen Jahren, Teilzahlung, Rückerstattung, Einlage/Entnahme und steuerliche Korrektur.
- EÜR verwendet Zahlungsdatum statt Rechnungsdatum und blockiert ungeklärte Zahlungszuordnungen.
- Anlagevermögen ohne geprüftes Anlagenverzeichnis setzt `incomplete` und verhindert „bereit zur Übertragung“.
- Query-Budget/N+1 und großer asynchroner Export.
- Backup-Roundtrip für Mapping, Export-Metadaten und steuerliche Korrekturen.

## Akzeptanzkriterien

- [ ] Alle Reports verwenden denselben Query-/Status-Kern.
- [ ] `basis=posted` ist Standard; Entwurfsvorschau ist unübersehbar markiert.
- [ ] SuSa, GuV, Bilanz, BWA, Journal und Kontobewegungen erfüllen die fachlichen Anforderungen.
- [ ] PDF/CSV/XLSX funktionieren wirklich; der bisher funktionslose PDF-Button ist entfernt.
- [ ] BWA bietet Monat, kumuliert, Vorjahr und Drill-down.
- [ ] USt-VA-Eingabehilfe zeigt Kennziffern, Herleitung und Zahllast/Erstattung.
- [ ] Kein Screen behauptet, eine Meldung sei an das Finanzamt gesendet worden.
- [ ] ELSTER-XML bleibt deaktiviert, bis Schema- und Upload-Test grün sind.
- [ ] EÜR ist ein eigener Zu-/Abfluss-Report mit Feldmapping, Herleitung und manueller ELSTER-Eingabehilfe.
- [ ] EÜR wird bei ungeklärten Zahlungen, nicht unterstützten Sachverhalten oder fehlender AVEÜR-Grundlage nicht als vollständig dargestellt.
- [ ] Golden-Master-, Storno-, Tenant-, Export-, Performance- und Backup-Tests sind grün.

## Nicht-Ziele

- Keine direkte Finanzamt-/ERiC-Übermittlung und keine Zertifikatsverwaltung.
- Keine E-Bilanz oder Anlagenbuchhaltung/automatische AfA; dafür werden bei Priorisierung eigene Specs erstellt.
- Keine Steuerberatungs-Garantie und keine Unterstützung aller USt-Sonderfälle im MVP.