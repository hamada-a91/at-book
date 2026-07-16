# SPEC-08 – Feature: Projekte, Kostenstellen & Kostenträger

**Phase:** 3 · **Aufwand:** ~2–3 Wochen · **Abhängigkeiten:** SPEC-03 (TenantExists), SPEC-04 (Service-Buchen), SPEC-07 (Indizes) · **Design-Basis:** [../09-roadmap.md](../09-roadmap.md)

## Fachliches Modell
- **Kostenstelle (KOST1):** *wo* Kosten entstehen (Abteilung/Standort). Unabhängige Dimension.
- **Kostenträger (KOST2):** *wofür* (Projekt/Auftrag/Produktlinie). Unabhängige Dimension.
- **Projekt:** Stammdaten-Klammer (Kunde, Budget, Laufzeit) mit genau einem eigenen Kostenträger (auto-angelegt) – wie in Lexware/DATEV üblich.
- Beide Dimensionen sitzen an der **Buchungszeile** (`journal_entry_lines`), nicht am Header.

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
               NumberSequenceService 'project'), name, contact_id (TenantExists),
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
GET  /api/projects/{id}/summary          # Budget vs. Ist (Erlöse, Kosten, Saldo, offene Belege)
GET  /api/reports/cost-centers?from&to   # Summen je Kostenstelle (BAB-light)
GET  /api/reports/projects/{id}/profitability
```
Alle FK-Validierungen mit `TenantExists`; Dimensionen dürfen nur `active` sein; Deaktivieren statt Löschen, sobald Buchungen referenzieren (`delete` → 422 mit Hinweis).

### Frontend
- Neue Seiten: `pages/Projects/ProjectsList.tsx`, `ProjectDetail.tsx` (Summary + Buchungsliste), `CostCentersList.tsx` (kombinierte Verwaltung KOST1/KOST2 mit Tabs).
- Selektoren: `CostDimensionSelector.tsx` (wiederverwendbar, Muster `AccountSelector`).
- Navigation in `MainLayout` hinter Modul-Flag.

## Akzeptanzkriterien
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
