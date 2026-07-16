# 09 – Roadmap & Design-Skizzen für geplante Features

Reihenfolge laut Produktplanung: **erst bestehende Funktionen härten** (siehe [08-kritische-punkte.md](08-kritische-punkte.md)), dann neue Features.

---

## Feature 1: Projekte mit Kostenstellen & Kostenträgern

### Fachlicher Hintergrund
- **Kostenstelle (KOST1):** *Wo* entstehen Kosten (Abteilung, Standort, Filiale).
- **Kostenträger (KOST2):** *Wofür* entstehen Kosten (Projekt, Auftrag, Produkt).
- In DATEV/Lexware sind das zwei unabhängige Dimensionen an jeder Buchungszeile. Projekte fassen typischerweise einen Kostenträger + Stammdaten (Kunde, Budget, Laufzeit) zusammen.

### Vorgeschlagenes Datenmodell (neues Modul `app/Modules/Projects/`)

```
cost_centers   (id, tenant_id, public_id, code, name, description, active, timestamps)
cost_objects   (id, tenant_id, public_id, code, name, description, active, timestamps)  # Kostenträger
projects       (id, tenant_id, public_id, number, name, contact_id, cost_object_id,
                budget_amount (Cents), starts_on, ends_on, status, timestamps)

journal_entry_lines:  + cost_center_id (nullable FK), + cost_object_id (nullable FK)
invoice_lines / beleg_lines / order_lines / quote_lines:  + project_id (nullable)
```

### Regeln
1. Dimensionen sitzen an der **Buchungszeile**, nicht am Header (eine Buchung kann mehrere Kostenstellen betreffen).
2. Beim automatischen Buchen (Invoice/Beleg → Journal) werden `project_id`/Kostendimensionen der Dokumentzeilen in die Journalzeilen durchgereicht.
3. Unique-Codes **pro Tenant** (`unique(tenant_id, code)`) + `tenant_id`-Index — von Anfang an (Fehler aus der Vergangenheit nicht wiederholen, siehe 08).
4. `BelongsToTenant` + `HasPublicId` + Backup-Transformer (`Services/Backup/Transformers/`) direkt mitliefern, sonst bricht das Backup-Modul.
5. Auswertungen: neue Reports `project-profitability` (Erlöse./.Kosten je Kostenträger), `cost-center-report` (BAB-light).

### API-Skizze
```
CRUD /api/cost-centers, /api/cost-objects, /api/projects
GET  /api/projects/{id}/summary        # Budget vs. Ist
GET  /api/reports/cost-centers?from=&to=
GET  /api/reports/projects/{id}/profitability
```

---

## Feature 2: OCR – Belege automatisch erfassen & buchen

### Andockpunkt
Der Beleg-Workflow existiert bereits: Upload (`POST /api/belege/{beleg}/upload`) → `belege` + `beleg_lines` → `book()`. OCR schiebt sich davor:

```
Upload (PDF/Foto)
   ▼
Queue-Job: OcrExtractJob (eigene Queue "ocr")
   ▼
OCR/Extraktion  ──►  belege.ocr_data (JSONB: Lieferant, Datum, Beträge, USt-Sätze,
                     Rechnungsnummer, IBAN, Positionsdaten, Konfidenzen)
   ▼
Vorschlagslogik: Kontakt-Matching (Name/USt-ID/IBAN) + Kontenvorschlag
   ▼
UI: BelegCreate vorbefüllt, User bestätigt/korrigiert  →  book()
```

### Technologie-Optionen
| Option | Bewertung |
|---|---|
| **LLM mit Vision (empfohlen):** Claude API – PDF/Bild rein, strukturiertes JSON raus | Beste Qualität bei deutschen Rechnungen, minimaler eigener Code; Kosten pro Beleg |
| Self-hosted: Tesseract + Regex/Parser | Kostenlos, aber schwache Qualität bei Layouts |
| Spezial-APIs (Klippa, Mindee, Azure Document Intelligence) | Gut, aber Vendor-Lock-in |

Wichtig: **ZUGFeRD/XRechnung zuerst prüfen** – viele deutsche E-Rechnungen (Pflicht seit 2025!) enthalten strukturierte XML-Daten im PDF; dann ist gar kein OCR nötig. Reihenfolge im Job: 1) XML-Extraktion (ZUGFeRD), 2) OCR-Fallback.

### Vorbereitung (jetzt schon sinnvoll)
- `belege` um `ocr_status`, `ocr_data (jsonb)`, `ocr_confidence` erweitern.
- Queue-Infrastruktur ist vorhanden (database-Driver); für OCR eigene Queue + ggf. Umstieg auf Redis.
- **GoBD:** Originaldatei unverändert aufbewahren, OCR-Ergebnis nur als Vorschlag – Buchung erst nach User-Bestätigung (oder klar gekennzeichnete Auto-Buchung mit Audit-Log).

---

## Feature 3: AI-Integration (Buchungsassistent)

### Sinnvolle Einsatzfelder (aufsteigende Komplexität)
1. **Kontierungsvorschlag:** Belegtext/OCR-Daten → Vorschlag für Gegenkonto + Steuerschlüssel (Kontext: Tenant-Kontenplan + historische Buchungen ähnlicher Lieferanten).
2. **Kontakt-/Dublettenerkennung** beim Belegimport.
3. **Chat-Assistent** („Wie hoch waren meine Ausgaben für Fahrzeuge in Q2?“) → Übersetzung in Report-Queries (kein direkter SQL-Zugriff durch das Modell!).
4. **Anomalie-Hinweise** (doppelte Rechnung, ungewöhnlicher Betrag).

### Architektur-Empfehlung
- Eigener Service `app/Services/Ai/` (oder Modul `Modules/Ai`) mit klarem Interface, Provider austauschbar (Claude API empfohlen; SDK-Referenz: Skill/Doku `claude-api` beachten).
- AI-Aufrufe **immer asynchron** (Queue) und **nie autonom buchen** – Vorschläge mit Konfidenz, User bestätigt. Jede AI-Aktion ins Audit-Log.
- **Datenschutz:** Belegdaten sind personenbezogen → AVV mit dem API-Anbieter, keine Trainings-Nutzung, ggf. Pseudonymisierung; pro Tenant abschaltbar (`company_settings`-Flag, analog `module_inventory_enabled`).

---

## Voraussetzungen aus 08 (vor Feature-Start erledigen)

| Feature | Blockierende Punkte aus 08 |
|---|---|
| Projekte/Kostenstellen | P0/4 (TenantExists-Rule), P2/13 (Indizes), Modul-Entscheidung P2/16 |
| OCR | P1/6 (Transaktionen beim Buchen), P1/9 (Audit-Log), Queue-Härtung |
| AI | P2/19 (API-Versionierung + Fehlerformat), P0/5 (Auth-Härtung), Tests/CI P2/17 |
