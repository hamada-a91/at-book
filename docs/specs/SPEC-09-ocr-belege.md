# SPEC-09 - Feature: OCR-Belegerfassung

**Phase:** 3 - **Status:** in Arbeit / Phase 1 umgesetzt - **Engine Phase 1:** lokal gehostetes Tesseract-OCR
**Abhaengigkeiten:** SPEC-04 (transaktionales Buchen), SPEC-05 (Nummern), SPEC-06 (Audit) - **Design-Basis:** [../09-roadmap.md](../09-roadmap.md)

## Ziel
Beleg hochladen -> automatische Datenextraktion -> vorbefuellter Buchungsvorschlag -> User prueft/korrigiert -> User bestaetigt -> Buchung. **Nie autonom buchen ohne Bestaetigung** (GoBD + Vertrauen).

## Extraktions-Pipeline Phase 1

```
Upload (PDF/JPG/PNG, max 20 MB)
  1) PDF mit Textebene? -> Text direkt per smalot/pdfparser extrahieren, KEIN OCR noetig
  2) Sonst Foto/Scan-PDF -> PDF-Seiten per poppler/pdftoppm rendern -> Tesseract OCR lokal mit Sprache deu
  3) Heuristik-Parser -> strukturierte Vorschlagsdaten mit Konfidenz je Feld
  4) Fehlerfall -> Status failed, Beleg bleibt manuell nutzbar
```

Wichtig: In Phase 1 werden **keine externen APIs** verwendet und keine Belegdaten nach aussen gesendet. Der bisherige Abschnitt zur Claude-API ist durch self-hosted Tesseract ersetzt.

## Extrahierte Felder
- Lieferant: Name, Kontaktvorschlag ueber tenant-scoped Matching gegen `contacts.tax_number`, `contacts.bank_account` und Namens-Fuzzy.
- Belegdatum, Rechnungsnummer, Faelligkeit.
- Netto/USt/Brutto je erkannter Rechnung, Steuersatz 19%/7%, Waehrung (Default EUR).
- Optionaler Sachkonto-Vorschlag per Stichwort-Heuristik, z.B. Telekom/Telefon/Internet -> Telekommunikationskosten.
- Alle Betraege in `ocr_data` werden als Integer-Cents gespeichert.
- Jedes Feld enthaelt `value`, `confidence` und `source`; unsichere Werte werden im Frontend zur Pruefung markiert.

## 9.1 Schema-Erweiterung `belege`

```php
+ ocr_status string default 'none' // none|pending|processing|done|failed
+ ocr_data jsonb nullable          // Rohtext + strukturierte Extraktion + Konfidenzen
+ ocr_provider string nullable     // 'tesseract'
```

## 9.2 Ablauf
1. `POST /api/belege/ocr-upload`: nimmt PDF/JPG/PNG bis 20 MB an, speichert die Originaldatei unveraendert, legt einen Beleg-Draft an, setzt `ocr_status=pending`, dispatcht `ProcessBelegOcrJob` auf Queue `ocr` und antwortet mit HTTP 202.
2. `ProcessBelegOcrJob`: setzt den Tenant-Kontext explizit per `app()->instance('currentTenant', $tenant)`, setzt `processing`, fuehrt PDF-Textlayer-Extraktion oder Tesseract aus, parst die Felder, schreibt `ocr_data`, setzt `done` oder im Fehlerfall `failed`.
3. `GET /api/belege/{beleg}` liefert `ocr_status`, `ocr_provider` und `ocr_data`; das Frontend pollt bis `done` oder `failed`.
4. Frontend `BelegCreate.tsx`: Upload per Kamera/File/Drag-and-drop, Polling via React Query, Vorbefuellung der vorhandenen Belegmaske, Markierung niedriger Konfidenzen. User speichert/korrigiert und bucht danach ueber den bestehenden `book`-Flow.
5. Audit-Log-Event: `beleg_ocr_extracted` nach erfolgreicher Extraktion.

## 9.3 Lokale Tesseract-Anbindung
- Composer: `thiagoalessio/tesseract_ocr`, `smalot/pdfparser`.
- Containerpakete: `tesseract-ocr`, `tesseract-ocr-deu`, `poppler-utils` in Sail- und Produktions-Dockerfile.
- Runtime prueft defensiv, ob `tesseract` bzw. `pdftoppm` verfuegbar sind; falls nicht, wird OCR sauber auf `failed` gesetzt.
- Tests trennen Parser und OCR-Ausfuehrung, damit Parser-Tests ohne lokale Binaries laufen.

## 9.4 Backup-Impact
- `BelegTransformer` exportiert/importiert `ocr_status`, `ocr_data`, `ocr_provider`.
- Alte Backups ohne OCR-Felder bleiben importierbar; DB-Defaults setzen `ocr_status=none`.
- Beleg-Dateien sind im bestehenden Backup-Modul bereits als `files/belege/{public_id}/...` im Manifest enthalten und werden beim Import wiederhergestellt.
- Roundtrip-Test deckt einen OCR-Beleg ab.

## Akzeptanzkriterien Phase 1
- [x] PDF mit Textebene -> Felder ohne OCR-Aufruf extrahierbar.
- [x] Bild/Scan-PDF -> lokale Tesseract-Pipeline vorbereitet.
- [x] OCR-Fehler -> Beleg bleibt Draft/manuell nutzbar, Status `failed`.
- [x] Kein automatisches Buchen: `book` erfordert expliziten User-Request.
- [x] Job setzt Tenant-Kontext explizit.
- [x] Backup-Transformer und Roundtrip-Test um OCR-Felder erweitert.

## Folgepakete
- ZUGFeRD/XRechnung-XML-Erkennung vor PDF/OCR.
- Intelligentere Konto-/Kategorie-Vorschlaege in SPEC-10.
- Optionaler KI-Provider nur mit expliziter Datenschutz-/Mandantenfreigabe, nicht Bestandteil von Phase 1.
