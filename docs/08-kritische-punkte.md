# 08 – Kritische Punkte & Verbesserungsvorschläge

Ergebnis der Code-Analyse vom 16.07.2026, **nach Priorität sortiert**. Jeder Punkt nennt Fundort, Risiko und empfohlene Lösung. Beim Abarbeiten bitte Punkte hier abhaken/aktualisieren.

---

## 🔴 P0 – Sicherheit (sofort beheben)

### 1. Öffentliche Schema-Manipulations-Route
- **Fundort:** `routes/api.php` (Anfang der Datei): `GET /api/force-schema-fix`
- **Problem:** Unauthentifizierte Route, die per HTTP-Aufruf DB-Constraints ändert (dropUnique/addUnique). Jeder im Internet kann sie aufrufen.
- **Lösung:** Route komplett entfernen (der Fix ist längst als Migration `2025_12_26_…` / `2025_12_27_…` vorhanden). Auch `routes/schema_fix.php` löschen.

### 2. Admin-API ohne Rollenprüfung
- **Fundort:** `routes/api.php`, Gruppe `/api/admin/*`; `AdminController`, `Admin/SerialNumberController`
- **Problem:** Nur `auth:api` – **jeder eingeloggte User jedes Tenants** kann: alle Tenants und alle User plattformweit auflisten, User sperren/entsperren, Seriennummern anlegen/löschen, Bug-Reports aller Tenants lesen/ändern.
- **Lösung:** Middleware `role:admin` (Spatie) auf die Gruppe legen und/oder Policy-Checks in den Controllern. Zusätzlich Test schreiben, der mit Nicht-Admin 403 erwartet.

### 3. Hartcodierter `APP_KEY` + `APP_DEBUG=true` in Produktion
- **Fundort:** `compose.production.yaml` (Key steht im Klartext im Git-Repo, zweimal)
- **Problem:** Mit bekanntem APP_KEY sind verschlüsselte Daten/Cookies/signierte URLs angreifbar. `APP_DEBUG: 'true'` leakt bei Fehlern Stacktraces und Konfiguration.
- **Lösung:** Neuen Key generieren, per `.env`/Secret injizieren, alten Key aus der Git-Historie als kompromittiert betrachten. `APP_DEBUG=false` setzen. Prüfen, ob JWT_SECRET ebenfalls sicher verwaltet ist.

### 4. Cross-Tenant-Referenzen durch ungescopte `exists:`-Validierung
- **Fundort:** u.a. `InvoiceController::store()` (`lines.*.account_id => exists:accounts,id`, `contact_id`), `JournalEntryController::store()` (`account_id`, `contact_id`, `beleg_id`), analog Quote/Order/Beleg-Controller
- **Problem:** `exists:` prüft gegen die gesamte Tabelle ohne Global Scope. Ein User kann Buchungszeilen auf **Konten fremder Tenants** anlegen (Zeilen haben keine eigene tenant_id → der Fremdbezug wird gespeichert). Datenintegrität + Isolationsbruch.
- **Lösung:** Überall `Rule::exists('accounts', 'id')->where('tenant_id', tenant()->id)` verwenden. Am besten als eigene Rule-Klasse `TenantExists` zentralisieren. Danach Isolationstests ergänzen.

### 5. JWT im `localStorage` + globaler fetch-Override
- **Fundort:** `resources/js/app.tsx`
- **Problem:** Token im localStorage ist bei XSS auslesbar; 7-Tage-TTL erhöht das Schadensfenster. Der fetch-Override loggt zudem jede Token-Anheftung in die Browser-Konsole (`console.log('🔐 …')`).
- **Lösung (mittelfristig):** HttpOnly-Cookie-Auth (Sanctum SPA-Modus wäre bereits installiert) oder mindestens kürzere TTL + Refresh-Flow. Sofort: console.log entfernen, fetch-Override durch die zentrale axios-Instanz ersetzen.

---

## 🟠 P1 – Fachliche Korrektheit / GoBD

### 6. Rechnungsbuchung ohne DB-Transaktion
- **Fundort:** `InvoiceController::book()` (auch `recordPayment()`, `BelegController::book()` prüfen)
- **Problem:** JournalEntry, Zeilen, Invoice-Update und Lagerabgänge werden ohne `DB::transaction()` ausgeführt. Bricht ein Schritt ab, bleiben halbe Buchungen/inkonsistente Bestände zurück.
- **Lösung:** Gesamten Ablauf in `DB::transaction()` kapseln; besser: Logik in den `BookingService`/einen `InvoiceBookingService` verschieben (Controller ist mit ~500 Zeilen zu fett).

### 7. Keine lückenlose, gesperrte Nummernvergabe
- **Fundort:** `InvoiceController::store()` (Rechnungsnummer = letzte Nummer + 1), analog Belege/Angebote/Aufträge
- **Problem:** Race Condition bei parallelen Requests (doppelte Nummern → Unique-Fehler) und keine GoBD-lückenlose Vergabe.
- **Lösung:** Nummernkreis-Tabelle (`number_sequences` je Tenant/Typ/Jahr) mit `SELECT … FOR UPDATE` in einer Transaktion; Vergabe erst beim Festschreiben/Versand statt beim Draft.

### 8. Rechnungsbuchung wird nicht festgeschrieben; USt-Konto hartcodiert
- **Fundort:** `InvoiceController::book()`
- **Problem:** (a) JournalEntry wird als `posted` ohne `locked_at` erzeugt → formal „festgeschrieben“-Status ohne Sperrwirkung; das GoBD-Konzept (draft→lock) wird umgangen. (b) USt-Konto wird über Code `'1776'` (SKR03, 19%) gesucht – 7%-Positionen laufen falsch, SKR04 wäre kaputt. (c) Steuersplit nach Steuersatz nutzt nur `tax_total` gesamt.
- **Lösung:** Buchen über den `BookingService` laufen lassen (inkl. `lockBooking`), USt-Konten über `tax_codes`-Mapping je Steuersatz auflösen, Steuerbeträge je Steuersatz-Gruppe buchen.

### 9. Audit-Log nicht aktiv
- **Fundort:** `Modules/Accounting/Models/AuditLog` existiert; Aufruf im `BookingService` auskommentiert
- **Problem:** GoBD verlangt Nachvollziehbarkeit von Änderungen; aktuell wird nichts protokolliert.
- **Lösung:** Model-Observer für JournalEntry/Invoice/Beleg (created/updated/locked/reversed) → `audit_logs` mit User, Tenant, Diff.

### 10. `BookingService`-Detailfehler
- **Fundort:** `Modules/Accounting/Services/BookingService`
- **Probleme:** (a) `user_id => Auth::id() ?? 1` – Fallback auf User 1 verfälscht die Urheberschaft; (b) strikter Vergleich `$debitSum !== $creditSum` schlägt bei Int-vs.-Float-Mischung fehl (derzeit durch `integer`-Validierung abgefangen, aber fragil); (c) `lockBooking`/`reverseBooking` laden per `findOrFail` – ohne Tenant-Kontext (z.B. Tinker/Job) wäre jede Buchung greifbar.
- **Lösung:** Fallback entfernen (Exception werfen), Summen explizit als int casten, TODO „lückenlose Journalnummer beim Lock“ umsetzen (siehe 7).

### 11. Betrags-Spalten inkonsistent (integer vs. bigInteger) & Float-Risiko
- **Fundort:** `invoices.subtotal/tax_total/total` = `integer` (max ~21,4 Mio €), `journal_entry_lines.amount` = `bigInteger`; `quantity * unit_price` mit `numeric` quantity erzeugt Floats vor dem Speichern.
- **Lösung:** Migration auf `bigInteger` für alle Betragsspalten; Zeilensummen mit `(int) round(...)` festziehen; Rundungsregel (pro Zeile) dokumentieren.

---

## 🟡 P2 – Codequalität & Performance

### 12. Fette Controller, Logik nicht in Services
`InvoiceController` (Buchung, Zahlung, PDF, Mail, Lager – alles inline), ähnliches bei Quote/Order/Beleg. → Geschäftslogik in Services ziehen (BookingService als Vorbild), FormRequest-Klassen statt Inline-Validierung.

### 13. Fehlende Indizes auf `tenant_id`
Die Nachrüst-Migration (`2025_12_25_000002`) legte nur FKs an – **PostgreSQL indiziert FK-Spalten nicht automatisch**. Tabellen ohne tenant_id-Index (u.a. `journal_entries`, `contacts`, `bank_accounts`, `company_settings`): jede gescopte Query macht Seq-Scans. → Migration mit `index(['tenant_id'])` bzw. zusammengesetzten Indizes (`tenant_id, booking_date` für Journal, `tenant_id, status` für Belege/Invoices).

### 14. `OnboardingMiddleware` macht pro Request eine DB-Query
`CompanySetting::first()` bei jedem Fach-Request. → pro Tenant cachen (`Cache::remember("onboarding:{$tenantId}", …)`), Invalidierung bei `/onboarding/complete`.

### 15. Doppelte Auth-/Tenant-Mechanik im Code
Viele Controller holen den Tenant manuell (`getTenantOrFail()` + `where('tenant_id', …)`), obwohl der Global Scope das bereits erledigt – doppelt gemoppelt und inkonsistent (manche Stellen verlassen sich nur auf den Scope). → Eine Konvention festlegen: Global Scope als Standard, `getTenantOrFail()` nur wo der Tenant selbst gebraucht wird.

### 16. Modul-Struktur inkonsistent
`app/Modules/{Accounting,Contacts,Documents}` vs. alles andere flach in `app/Models`. → Entscheidung treffen (Empfehlung: neue Domänen als Module, bestehende schrittweise migrieren; Projekte/Kostenstellen direkt als `Modules/Projects` starten).

### 17. Kaum Tests, kein CI
Nur 3 nennenswerte Feature-Tests. Keine Tests für BookingService, Rechnungsbuchung, Reports, Rollen. Kein CI-Workflow. → GitHub Actions (o.ä.): `pint --test`, `artisan test`, `npm run build` bei jedem Push; Kernpfade mit Tests absichern **bevor** OCR/AI-Features aufgesetzt werden.

### 18. Frontend-Altlasten
fetch-Override + axios parallel (siehe P0/5), `Onboarding.tsx.broken`, Inline-API-Calls statt `services/`-Layer, `install`/`npm` fälschlich als dependencies in `package.json`. → aufräumen.

### 19. Keine API-Versionierung & keine einheitliche Fehlerstruktur
Antworten mischen `{error: …}` und `{message: …}`, Statuscodes uneinheitlich (422 vs. 500 mit Exception-Message nach außen). → `/api/v1`-Prefix, zentrale Exception-Handler-Formatierung, keine rohen Exception-Messages an Clients (Information Disclosure).

---

## 🟢 P3 – Repo-Hygiene

20. **Root aufräumen:** ~30 historische MD-Dateien (`ALL_FIXES_COMPLETE.md`, `QUICK_FIX_GUIDE.md`, …), `debug_*.php`, `booking_test.json`, `implementation_plan.md.resolved`, einmalige `setup-*.sh`/`replace-bookingcreate.sh` → nach `archive/` verschieben oder löschen. `.phpunit.result.cache` in `.gitignore`.
21. **Tote Controller-Dateien:** `Api/InvoiceController_PDF_SNIPPET.php`, `Api/InvoiceController_UPDATE.php` – keine echten Controller, verwirren Autoloading/Agents → löschen.
22. **Duplizierte Migrationen** (beleg_lines 3×, add_beleg_id 2×, payment_fields 2×, product_id_to_invoice_lines 2×): funktionieren dank Guards, aber Neuinstallationen sind schwer nachvollziehbar. Nicht rückwirkend ändern, aber: keine neuen „Fix“-Migrationen mit hasColumn-Guards mehr – sauber eine Migration pro Änderung.
23. **Tippfehler-Rolle `cachier`** → bei nächster Gelegenheit auf `cashier` migrieren (mit Daten-Migration der Zuweisungen).
24. **`.env` liegt im Repo-Verzeichnis mit echten Werten** – sicherstellen, dass sie in `.gitignore` ist (ist sie), Produktions-Secrets nie committen (siehe P0/3).

---

## Empfohlene Reihenfolge

1. **Sofort (1 Tag):** P0/1 Route löschen, P0/2 `role:admin`-Middleware, P0/3 Key-Rotation + DEBUG=false, console.log entfernen.
2. **Diese Woche:** P0/4 TenantExists-Rule überall, P1/6 Transaktionen, Tests für Isolation + Buchen.
3. **Nächster Sprint:** P1/7–11 (Nummernkreise, Festschreibung, Audit-Log, Betragsspalten) + P2/13 Indizes + CI (P2/17).
4. **Laufend:** P2-Refactorings und P3-Hygiene – idealerweise bevor die Roadmap-Features (Projekte, OCR, AI) starten, damit neue Features auf sauberem Fundament stehen.
