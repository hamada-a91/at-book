# SPEC-08 – Feature: Projekte, Kostenstellen & Kostenträger

**Phase:** 3 · **Aufwand:** ~2–3 Wochen · **Abhängigkeiten:** SPEC-03 (TenantExists), SPEC-04 (Service-Buchen), SPEC-07 (Indizes) · **Design-Basis:** [../09-roadmap.md](../09-roadmap.md)

## Fachliches Modell
- **Kostenstelle (KOST1):** *wo* Kosten entstehen (Abteilung/Standort). Unabhängige Dimension.
- **Kostenträger (KOST2):** *wofür* (Projekt/Auftrag/Produktlinie). Unabhängige Dimension.
- **Projekt:** Stammdaten-Klammer (Kunde, Budget, Laufzeit) mit genau einem eigenen Kostenträger (auto-angelegt) – wie in Lexware/DATEV üblich.
- **Projekte können intern sein** (ohne Kunde, z.B. eigenes Produkt „BieneB“): `contact_id` ist **nullable**. Kunden- und interne Projekte verhalten sich identisch; nur der Kosten-Nachweis (s.u.) ist bei internen Projekten ohne Empfänger.
- Beide Dimensionen sitzen an der **Buchungszeile** (`journal_entry_lines`), nicht am Header.

### UI-Leitprinzip: Projekt-zentriert
Der Nutzer denkt in **Projekten**, nicht in KOST-Dimensionen. In der UI wählt er überall nur „Projekt“ (am Beleg, an der Rechnung, an der Buchungszeile) – das Mapping auf den Kostenträger passiert unsichtbar im Hintergrund. Kostenstellen (KOST1) sind ein **optionales Zusatzfeld für Fortgeschrittene** (eigener Settings-Toggle, standardmäßig ausgeblendet). Die Buchungserfassung darf durch das Feature nicht komplizierter werden.

## Neues Modul `app/Modules/Projects/`

```
Modules/Projects/
├── Models/CostCenter.php        # BelongsToTenant + HasPublicId
├── Models/CostObject.php        # dito (Kostenträger)
├── Models/Project.php           # dito
├── Services/ProjectReportService.php
└── (Http bleibt zentral in app/Http/Controllers/Api/)
```

### Migrationen (Regeln aus 03/08 von Anfang an!)
```php
cost_centers:  id, tenant_id (FK, index), public_id, code, name, description,
               active (default true), timestamps, unique(tenant_id, code)
cost_objects:  identisch aufgebaut
projects:      id, tenant_id (FK, index), public_id, number (unique je tenant, aus
               NumberSequenceService 'project'), name,
               contact_id (nullable! TenantExists – null = internes Projekt),
               cost_object_id (FK), budget_amount (bigint Cents, nullable),
               starts_on, ends_on, status (active|completed|archived), notes, timestamps

journal_entry_lines:  + cost_center_id (nullable FK), + cost_object_id (nullable FK), Index auf beide
invoice_lines, beleg_lines, quote_lines, order_lines:  + cost_center_id, + cost_object_id (nullable)
invoices, belege, quotes, orders:  + project_id (nullable FK)  # Default-Zuordnung fürs ganze Dokument
```

### Durchreich-Logik
1. Dokument bekommt optional `project_id` (Default für alle Zeilen) und/oder Dimensionen pro Zeile (Zeile überschreibt Dokument-Default).
2. `InvoiceBookingService`/Beleg-Buchen (SPEC-04) kopiert die aufgelösten Dimensionen in die erzeugten `journal_entry_lines`.
3. Manuelle Buchungsmaske (`BookingMask.tsx`): zwei optionale Selects je Zeile (KOST1/KOST2), nur sichtbar wenn Modul aktiv.
4. Modul-Flag `module_projects_enabled` in `company_settings` (Muster: `module_inventory_enabled`); Onboarding/Settings-Toggle.

### API
```
CRUD /api/cost-centers, /api/cost-objects, /api/projects       (Rollen: owner, manager, buchhalter)
GET  /api/projects/{id}/summary          # Budget vs. Ist (Erlöse, Kosten, Gewinn, offene Belege)
GET  /api/projects/{id}/entries?from&to  # Alle Buchungen/Belege des Projekts (für Detail-Ansicht)
GET  /api/projects/{id}/cost-report?from&to        # Kosten-Nachweis als JSON
GET  /api/projects/{id}/cost-report/pdf?from&to    # ⭐ Kosten-Nachweis als PDF (s.u.)
GET  /api/reports/cost-centers?from&to   # Summen je Kostenstelle (BAB-light)
GET  /api/reports/projects/{id}/profitability
```

### ⭐ Projektkosten-Nachweis (kundentaugliches PDF)
Kernanwendungsfall: *„Dem Kunden nach einem Monat zeigen, dass für sein Projekt
10.000 € Kosten angefallen sind.“* Ein druckfertiges PDF (dompdf, gleiches
Briefpapier/Layout wie Rechnungen, Firmenlogo/Absender aus CompanySettings):
- Kopf: Projekt (Nummer, Name), Kunde (falls vorhanden), Zeitraum, Erstellungsdatum.
- Tabelle der **Kostenbuchungen** des Projekts im Zeitraum: Datum, Belegnummer,
  Beschreibung, **Netto, USt, Brutto** (drei Betragsspalten). Nur festgeschriebene
  Buchungen (`posted`/`cancelled` saldiert – Storni neutralisieren sich, siehe
  ReportsController-Prinzip).
- Summenzeile gesamt: **Summe Netto, Summe USt, Summe Brutto**; optional gruppiert nach Monat.
- Bewusst OHNE interne Details (keine Kontonummern, keine Erlöse/Margen!) –
  das Dokument geht an den Kunden. Erlöse/Gewinn sieht nur die interne
  Detail-Ansicht.
- Versand per E-Mail über den bestehenden SendDocumentMail-Mechanismus (optional,
  Button „Per E-Mail senden“ wie bei Rechnungen).
Alle FK-Validierungen mit `TenantExists`; Dimensionen dürfen nur `active` sein; Deaktivieren statt Löschen, sobald Buchungen referenzieren (`delete` → 422 mit Hinweis).

### Frontend
- Neue Seiten: `pages/Projects/ProjectsList.tsx` (mit Status-Filter aktiv/abgeschlossen) und `ProjectDetail.tsx`:
  - **KPI-Kacheln oben:** Umsatz, Kosten, **Gewinn**, Budget-Auslastung (Muster: Dashboard-Kacheln) – der „alles auf einen Blick“-Überblick.
  - Tabs: „Buchungen“ (alle Projekt-Buchungen/Belege), „Kosten-Nachweis“ (Zeitraumwahl + PDF-Download/-Versand), „Verlauf“ (AuditTrail-Komponente).
- Projekt-Auswahl beim Erfassen: `ProjectSelector.tsx` (Muster `ContactSelector`) am Beleg-, Rechnungs- und Buchungsformular – EIN Feld, keine KOST-Begriffe in der Standard-UI.
- `CostCentersList.tsx` (Verwaltung KOST1/KOST2) nur sichtbar, wenn der Fortgeschritten-Toggle aktiv ist.
- Navigation „Projekte“ in `MainLayout` hinter Modul-Flag `module_projects_enabled`.

## Akzeptanzkriterien
- [ ] **Internes Projekt ohne Kunde anlegbar** (contact_id null); Kunden-Projekt mit Kontakt ebenso
- [ ] **Kosten-Nachweis-PDF**: enthält nur Kostenbuchungen des Projekts im Zeitraum mit **Netto/USt/Brutto** je Zeile + Summenzeile (Netto/USt/Brutto); KEINE Erlöse, Margen oder Kontonummern; Layout wie Rechnungs-PDF; Storno-Paare neutralisieren sich
- [ ] Projekt-Detail zeigt Umsatz/Kosten/Gewinn korrekt (Abgleich mit Journal), interne Sicht getrennt vom Kunden-PDF
- [ ] Rechnung mit `project_id` buchen → Journalzeilen tragen Kostenträger des Projekts
- [ ] Zeilen-Dimension überschreibt Dokument-Default (Test)
- [ ] Kostenstellen-Report summiert korrekt über Zeitraum, nur eigener Tenant
- [ ] Projekt-Summary: Budget vs. Ist stimmt mit Journal überein (inkl. Storni!)
- [ ] Dimension mit Buchungen kann nicht gelöscht, nur deaktiviert werden
- [ ] Festschreibe-Regel: Dimensionen an gelockten Zeilen unveränderlich
- [ ] Tenant-Isolation-Tests für alle 3 neuen Entities

## Backup-Impact ⚠️ (Pflichtpaket, siehe Schutzregeln)
1. **3 neue Transformer** (`CostCenterTransformer`, `CostObjectTransformer`, `ProjectTransformer`) + Registry-Einträge **vor** quotes/orders/invoices/journal (Referenz-Reihenfolge: Dimensionen zuerst!).
2. Line-Transformer (`JournalEntryLineTransformer`, `InvoiceLineTransformer`, `BelegLineTransformer`, …) um `cost_center_public_id`/`cost_object_public_id`/`project_public_id` erweitern – Export über `public_id`, Import mappt zurück. Felder optional (alte Backups!).
3. Roundtrip-Test erweitern: Projekt + dimensionierte Buchung exportieren/importieren, Verknüpfung prüfen.
4. Referenz-Fixture v1.0 muss weiterhin importieren (alle neuen Felder nullable).
