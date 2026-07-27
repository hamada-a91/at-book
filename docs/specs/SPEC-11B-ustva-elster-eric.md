# SPEC-11B – Zukunft: USt-VA automatisch via ELSTER/ERiC übermitteln

**Phase:** Zukunft, nach SPEC-11A · **Priorität:** zurückgestellt · **Aufwand:** ca. 4–6 Wochen nach ELSTER-Zugang · **Abhängigkeiten:** vollständige SPEC-11A, ELSTER-Herstellerzugang, Hersteller-ID, Security-/Steuerfach-Review · **Status:** 🔲 später

## Ziel

Die in SPEC-11A fachlich korrekt vorbereitete USt-VA wird nach ausdrücklicher Nutzerbestätigung über die amtliche ERiC-Schnittstelle an die Finanzverwaltung übertragen. Annahme, Transferticket, Protokoll und Korrekturen werden unveränderlich historisiert.

```text
USt-VA aus SPEC-11A → ERiC-Plausibilisierung → Nutzer bestätigt + PIN
                   → verschlüsselte Übermittlung → Annahme/Ablehnung
                   → Ticket + Protokoll + Audit
```

Diese Spec blockiert SPEC-11A, OCR oder AI nicht.

## Voraussetzungen außerhalb des Codes

- Registrierung von AT-Book als ELSTER-Softwarehersteller/Entwickler.
- Zugriff auf das aktuelle ERiC-, Dokumentations- und Vordruckpaket.
- Hersteller-ID und geklärte Lizenz-/Verteilbedingungen.
- Plattformprüfung für die Produktionscontainer.
- Erfolgreiche amtliche Testfälle im ELSTER-Testverfahren.
- Steuerfachliches und Security-Review.

ERiC ist die von der Finanzverwaltung bereitgestellte C-Bibliothek zur Plausibilisierung und verschlüsselten Übermittlung: [ELSTER – Entwickler](https://www.elster.de/elsterweb/infoseite/entwickler).

Ohne alle Voraussetzungen bleibt `elster_submission_enabled=false`.

## Umfang

Nur die USt-Voranmeldung wird automatisiert. Die automatische EÜR-Übermittlung, E-Bilanz, Umsatzsteuer-Jahreserklärung, Dauerfristverlängerung und Zusammenfassende Meldung sind nicht enthalten und benötigen eigene Specs.

## 11B.1 Filing-Snapshot und Status

Neue tenant-scoped Entity `tax_filings`:

```text
id, tenant_id, public_id
filing_type              # zunächst nur ustva
period_start, period_end, tax_year, form_version, sequence_no
correction_for_id nullable
status                   # draft|validated|transmitting|accepted|rejected|failed
source_hash
calculated_values jsonb
payload_encrypted text nullable
validation_result jsonb nullable
eric_version, transfer_ticket nullable
submitted_by, submitted_at nullable
response_code, response_message nullable
protocol_path, protocol_sha256 nullable
timestamps
```

- `tax_filing_events` protokolliert append-only jeden Statuswechsel und Versuch.
- `validated` friert den fachlichen Snapshot ein.
- Ändern sich relevante Buchungen, stimmt der `source_hash` nicht mehr; Submit blockiert und verlangt neue Vorschau/Korrektur.
- Nur positive Annahmeserver-Rückmeldung setzt `accepted`.
- Angenommene Meldungen werden nie überschrieben. Erneute Abgabe ist eine referenzierte Korrektur.
- Idempotency-Key und Sequenz verhindern Doppelsendungen.

## 11B.2 ERiC-Adapter

Interface `ElsterGateway`:

```php
validate(TaxFiling $filing): ValidationResult
submit(TaxFiling $filing, CertificateSecret $secret): SubmissionResult
renderProtocol(TaxFiling $filing): StoredProtocol
```

Implementierungen:

- `FakeElsterGateway` für Tests,
- `EricElsterGateway` für ELSTER-Testmodus,
- dieselbe geprüfte Implementierung mit getrenntem Produktionsmodus.

ERiC läuft als gekapselter, versionierter nativer Adapter/Sidecar. Tenant-ID, Filing-`public_id`, Formularversion und Modus werden explizit übergeben. Fachliche Plausibilitätsfehler, Annahmeablehnung, Netzwerkfehler und interne Fehler sind getrennte Klassen; Originalcodes bleiben gespeichert.

Jedes ERiC-Update benötigt Support-Matrix, Staging-Test und Rollback. Jahresversionen werden nicht automatisch nur aufgrund des aktuellen Datums gewählt.

## 11B.3 Zertifikat und Geheimnisse

Neue Entity `tax_certificates` speichert nur tenant-scoped Metadaten, Fingerprint, Gültigkeit und einen KMS-/Envelope-verschlüsselten privaten Storage-Pfad.

- PIN standardmäßig nicht dauerhaft speichern.
- PIN nie in Request-, Queue-, Audit-, Exception- oder Application-Logs.
- PIN bleibt nur im Speicher des unmittelbaren ERiC-Aufrufs.
- Asynchroner Versand nur mit einmaligem Secret-Handoff, kurzer TTL und sicherer Löschung; niemals PIN in der Datenbank-Queue serialisieren.
- Upload/Austausch/Löschung nur mit `tax.manage_certificate`.
- Zertifikate werden nicht im normalen Tenant-Backup exportiert; nach Restore erneuter Upload.

## 11B.4 Bestätigung und UX

Vor „Jetzt an das Finanzamt senden“ zeigt AT-Book:

- Firma, Steuernummer, Finanzamt, Zeitraum und Formularversion,
- sämtliche amtliche Kennziffern und Beträge,
- Zahllast oder Erstattung,
- Datenqualitäts- und ERiC-Plausibilitätsstatus,
- Erst-, Null- oder Korrekturmeldung,
- Bestätigung „Angaben geprüft, vollständig und richtig“,
- PIN-Eingabe und finalen Bestätigungsdialog.

Die UI zeigt anschließend `transmitting`, `accepted`, `rejected` oder `failed`. „Erfolgreich gesendet“ darf nie aus einem eigenen HTTP 200 oder Queue-Start abgeleitet werden. Bei Annahme sind Transferticket und Protokoll-PDF downloadbar.

## API

```text
GET  /api/tax/filings
POST /api/tax/filings/ustva
GET  /api/tax/filings/{public_id}
POST /api/tax/filings/{public_id}/validate
POST /api/tax/filings/{public_id}/submit
POST /api/tax/filings/{public_id}/corrections
GET  /api/tax/filings/{public_id}/protocol

POST   /api/tax/certificates
GET    /api/tax/certificates/current
DELETE /api/tax/certificates/{public_id}
```

Alle Routen: `auth:api`, `SetTenantFromUser`, `onboarding.complete`, tenant-scoped Binding und `public_id`.

## Rollen, Audit, Datenschutz und Backup

Permissions: `tax.view`, `tax.prepare`, `tax.submit`, `tax.manage_certificate`. Owner erhält alle; Buchhalter View/Prepare/Submit, Zertifikatsverwaltung nur bewusst.

Audit-Events: `tax_filing_created/validated/submitted/accepted/rejected`, `tax_filing_correction_created`, `tax_certificate_uploaded/replaced/deleted`. Audit enthält keine PIN, Zertifikatsbytes oder vollständigen Payload.

Payload und Protokoll verschlüsselt speichern; Downloads autorisieren und kurzlebig signieren; Steuernummern in Logs maskieren. Replay-, Rate-Limit- und Idempotency-Schutz. Kein Drittanbieter-Analytics im Steuerbereich.

`tax_filings` und `tax_filing_events`: `BelongsToTenant`, `HasPublicId`, Transformer, Registry und Roundtrip-Test. Zertifikate/PINs werden nicht exportiert. Protokolle müssen verschlüsselt im Datei-Backup oder dauerhaft tenant-isoliert liegen. Import darf niemals einen Versand auslösen.

## Tests

- Amtliche ERiC-Testfälle für jede unterstützte Formularversion.
- Fake-Gateway: Annahme, Ablehnung, Plausifehler, Timeout, Retry.
- Geänderter Source-Hash blockiert; angenommener Snapshot bleibt unverändert.
- Doppelklick/Retry übermittelt nur einmal.
- Korrektur besitzt eigene Sequenz und Historie.
- PIN erscheint weder in DB/Queue noch Logs.
- Zertifikatsablauf und falsche PIN verständlich behandeln.
- Zwei Tenants können nie Zertifikat, Filing oder Protokoll des anderen sehen.
- Restore löst keinen Versand aus und verlangt erneuten Zertifikatsupload.

## Akzeptanzkriterien

- [ ] Herstellerzugang/-ID vorhanden; Plattform und Lizenz geklärt.
- [ ] ERiC-Testfälle für alle unterstützten Jahre bestanden.
- [ ] SPEC-11A-Datenqualität, Mapping und ERiC-Plausibilisierung sind vor Submit grün.
- [ ] Nutzer sieht und bestätigt die vollständige Meldung; PIN wird nicht persistiert.
- [ ] Nur positive Annahme setzt `accepted`.
- [ ] Transferticket und Protokoll sind unveränderlich gespeichert.
- [ ] Korrekturen, Idempotenz, Rollen, Tenant-Isolation und Fehlerfälle sind getestet.
- [ ] Security-Review, Monitoring, Incident-/Update-Runbook und Backup-Roundtrip sind abgeschlossen.

## Nicht-Ziele

- Keine automatische oder terminierte Abgabe ohne Nutzerbestätigung.
- Keine anderen Steuerarten als USt-VA.
- Keine Steuerberatungs-Garantie.
- Kein selbst gebauter Transport und keine Browser-Automation; ausschließlich ERiC.