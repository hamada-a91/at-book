# SPEC-09 – Feature: OCR-Belegerfassung

**Phase:** 3 · **Aufwand:** ~2–3 Wochen · **Abhängigkeiten:** SPEC-04 (transaktionales Buchen), SPEC-05 (Nummern), SPEC-06 (Audit) · **Design-Basis:** [../09-roadmap.md](../09-roadmap.md)

## Ziel
Beleg hochladen → automatische Datenextraktion → vorbefüllter Buchungsvorschlag → User bestätigt → Buchung. **Nie autonom buchen ohne Bestätigung** (GoBD + Vertrauen).

## Extraktions-Pipeline (Reihenfolge wichtig)

```
Upload (PDF/JPG/PNG, max 20 MB)
  1) ZUGFeRD/XRechnung-Check: eingebettetes XML im PDF?  → strukturierte Daten, KEIN OCR nötig
     (E-Rechnungs-Pflicht in DE seit 2025 → deckt zunehmend die Mehrheit ab)
  2) Fallback Vision-LLM: Claude API, PDF/Bild → strukturiertes JSON (Tool-Use/JSON-Schema)
  3) Fallback manuell: Status 'ocr_failed', User erfasst wie bisher
```

Extrahierte Felder: Lieferant (Name, USt-ID, IBAN), Belegdatum, Rechnungsnummer, Fälligkeit, Positionen (Beschreibung, Menge, Einzelpreis), Netto/USt/Brutto je Steuersatz, Währung + **Konfidenz je Feld**.

## Umsetzung

### 9.1 Schema-Erweiterung `belege`
```php
+ ocr_status enum('none','pending','processing','done','failed') default 'none'
+ ocr_data jsonb nullable          # Roh-Extraktion inkl. Konfidenzen
+ ocr_provider string nullable     # 'zugferd' | 'claude' | …
```

### 9.2 Ablauf
1. `POST /api/belege/ocr-upload` (neuer Endpoint): legt Beleg-Draft mit Datei an, `ocr_status=pending`, dispatcht `ProcessBelegOcrJob` auf Queue `ocr`.
2. Job (setzt Tenant-Kontext explizit! Muster `ProcessBackupExportJob`): Pipeline ausführen → `ocr_data` speichern, `ocr_status=done`.
3. **Vorschlagslogik** (`BelegSuggestionService`):
   - Kontakt-Matching: USt-ID → IBAN → Namens-Fuzzy (in dieser Reihenfolge); kein Treffer → „Neuen Lieferanten anlegen?“-Vorschlag.
   - Kontenvorschlag: historische Buchungen desselben Lieferanten (häufigstes Gegenkonto), sonst Kategorie-Heuristik; ab SPEC-10 per AI verfeinert.
4. Frontend `BelegCreate.tsx`: bei `ocr_status=done` Formular vorbefüllt, Konfidenz < 0.8 gelb markiert; Polling/Refetch via React Query auf den Belegstatus. User prüft → speichert → bucht wie bisher.
5. Original-Datei bleibt **unverändert** gespeichert (GoBD); `ocr_data` ist nur Vorschlag. Audit-Log-Events: `ocr_extracted`, `ocr_applied`.

### 9.3 Claude-API-Anbindung
- `app/Services/Ocr/` mit Interface `DocumentExtractor` + Implementierungen `ZugferdExtractor`, `ClaudeVisionExtractor` (austauschbar, Config `services.ocr.driver`).
- API-Key über `.env` (`ANTHROPIC_API_KEY`), nie committen. Timeout/Retry im Job (`tries=3`, Backoff), Kosten-Log je Aufruf (tenant_id, Tokens) für spätere Abrechnung.
- Prompt liefert JSON-Schema; Antwort validieren (zod-ähnlich serverseitig: `justinrainbow/json-schema` o.ä. oder manuelle Validierung) – **LLM-Ausgabe nie ungeprüft speichern**.
- Datenschutz: AVV mit Anthropic prüfen, Feature pro Tenant abschaltbar: `company_settings.module_ocr_enabled`.

## Akzeptanzkriterien
- [ ] ZUGFeRD-Testrechnung → Felder ohne LLM-Aufruf korrekt extrahiert
- [ ] Bild-Rechnung → Vorschlag mit Konfidenzen; UI markiert unsichere Felder
- [ ] Lieferanten-Matching über USt-ID nachweisbar (Test mit 2 ähnlichen Kontakten)
- [ ] OCR-Fehler (Provider down) → Beleg bleibt nutzbar, Status `failed`, manuelle Erfassung möglich
- [ ] Kein automatisches Buchen: `book` erfordert expliziten User-Request
- [ ] Job ohne HTTP-Kontext setzt Tenant korrekt (Isolationstest: 2 Tenants parallel)
- [ ] Extraktion erscheint im Audit-Log

## Backup-Impact ⚠️
- Neue `belege`-Spalten → `BelegTransformer` erweitern (`ocr_status`, `ocr_data`, `ocr_provider`), Felder optional für Alt-Backups.
- **Beleg-Dateien:** klären, ob `file_path`-Dateien im Backup-Export enthalten sind (aktuell laut Modul-Doku prüfen!). Falls nein: als bekannte Lücke in `backup-module.md` dokumentieren und Datei-Export als Folgepaket einplanen – mit OCR steigt die Bedeutung der Original-Dateien (GoBD-Aufbewahrung).
- Roundtrip-Test um OCR-Beleg erweitern.
