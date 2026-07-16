# 05 – API-Referenz

Alle Routen sind in `routes/api.php` definiert, Prefix `/api`. Auth via **JWT** (`Authorization: Bearer <token>`). Antworten sind JSON.

## Middleware-Ebenen

| Ebene | Routen |
|---|---|
| Öffentlich | `register`, `login`, `config`, `backup/download/{id}` (signiert) |
| `auth:api` + `SetTenantFromUser` | Onboarding, Settings, Kontenplan |
| zusätzlich `onboarding.complete` | Alle Fach-Routen (Dashboard, Buchungen, Rechnungen, …) |
| nur `auth:api` (⚠️ ohne Rollenprüfung!) | `/api/admin/*` |

## Authentifizierung

| Methode | Route | Beschreibung |
|---|---|---|
| POST | `/api/register` | Registrierung → erstellt **Tenant + Owner-User**, gibt JWT zurück |
| POST | `/api/login` | Login → JWT (TTL 7 Tage) |
| POST | `/api/logout` | Token invalidieren |
| GET | `/api/user` | Aktueller User |
| GET | `/api/config` | Öffentliche Konfiguration (z.B. Seriennummern-Aktivierung an/aus) |

## Onboarding & Einstellungen

| Methode | Route | Beschreibung |
|---|---|---|
| GET | `/api/onboarding/status` | Onboarding-Fortschritt |
| POST | `/api/onboarding/complete` | Onboarding abschließen |
| GET/POST | `/api/settings` | Firmeneinstellungen lesen/schreiben |
| POST | `/api/account-plan/generate` | SKR03-Kontenplan generieren (Geschäftsmodelle + Rechtsform) |
| POST | `/api/account-plan/extend` | Kontenplan um neue Geschäftsmodelle erweitern |
| GET | `/api/account-plan/status` / `/missing` | Status / fehlende Konten |

## Buchhaltung

| Methode | Route | Beschreibung |
|---|---|---|
| GET | `/api/accounts` · POST `/api/accounts` · GET `/api/accounts/{id}` | Konten |
| GET | `/api/accounts/balances` · `/api/accounts/{account}/balance` | Salden |
| GET/POST | `/api/bookings` | Journal auflisten / Buchung anlegen (Draft; Zeilen: `account_id`, `type` debit/credit, `amount` in Cents) |
| GET | `/api/bookings/{id}` | Buchung mit Zeilen |
| POST | `/api/bookings/{id}/lock` | **Festschreiben** (GoBD) |
| POST | `/api/bookings/{id}/reverse` | **Stornieren** (Generalumkehr) |

## Berichte (`/api/reports/...`)

`trial-balance` (SuSa), `profit-loss` (GuV), `balance-sheet` (Bilanz), `journal-export`, `account-movements`, `tax-report` (alle GET, mit Datums-Query-Parametern).

## Belege

| Methode | Route | Beschreibung |
|---|---|---|
| CRUD | `/api/belege` (apiResource, Parameter `{beleg}`) | Ein-/Ausgangsbelege |
| POST | `/api/belege/{beleg}/book` | Beleg verbuchen |
| POST | `/api/belege/{beleg}/upload` | Belegdatei hochladen |
| GET | `/api/belege/{beleg}/download` | Belegdatei herunterladen |

## Verkaufsprozess

| Methode | Route | Beschreibung |
|---|---|---|
| CRUD | `/api/quotes` | Angebote |
| POST | `/api/quotes/{quote}/send` / `accept` / `create-order` | Versenden / Annehmen / in Auftrag wandeln |
| GET | `/api/quotes/{id}/download-pdf` | PDF |
| CRUD | `/api/orders` | Aufträge |
| POST | `/api/orders/{order}/send` / `create-delivery-note` / `create-invoice` | Folgebelege erzeugen |
| GET | `/api/orders/{id}/download-pdf` | PDF |
| CRUD | `/api/delivery-notes` | Lieferscheine |
| POST | `/api/delivery-notes/{deliveryNote}/create-invoice` | Rechnung aus Lieferschein |

## Rechnungen

| Methode | Route | Beschreibung |
|---|---|---|
| CRUD | `/api/invoices` | Rechnungen (Zeilen mit `unit_price` in Cents, `tax_rate` in %) |
| POST | `/api/invoices/{invoice}/book` | Automatisch verbuchen (Debitor an Erlöse + USt) |
| POST | `/api/invoices/{invoice}/send` | Per E-Mail versenden (PDF) |
| POST | `/api/invoices/{invoice}/payment` | Zahlung erfassen (Bank an Debitor) |
| GET | `/api/invoices/{invoice}/pdf` | PDF herunterladen |

## Stammdaten & Warenwirtschaft

| Methode | Route | Beschreibung |
|---|---|---|
| CRUD | `/api/contacts` | Kontakte (legt automatisch Debitoren-/Kreditorenkonto an) |
| CRUD | `/api/products` | Produkte |
| GET/POST/PUT/DELETE | `/api/product-categories` | Produktkategorien |
| GET | `/api/inventory-report` | Inventurbericht |
| CRUD | `/api/bank-accounts` (+ `/{id}/set-default`) | Bankkonten |

## Benutzer & Organisation

| Methode | Route | Beschreibung |
|---|---|---|
| GET | `/api/roles` | Verfügbare Rollen |
| CRUD | `/api/users` | Benutzer des Tenants (Owner-Schutzlogik) |
| GET/POST | `/api/bug-reports` | Fehlerberichte einreichen/auflisten |
| GET/POST | `/api/dashboard/summary` / `chart` / `recent-bookings` | Dashboard-Daten |

## Backup (`/api/backup/...`)

| Methode | Route | Beschreibung |
|---|---|---|
| POST | `/export` | Export-Job starten (Queue `backups`) |
| GET | `/jobs` / `/jobs/{id}` | Jobstatus |
| GET | `/jobs/{id}/download-url` | Signierte Download-URL erzeugen |
| DELETE | `/jobs/{id}` · POST `/jobs/{id}/cancel` | Löschen / Abbrechen |
| POST | `/import/upload` → `/import/{id}/validate` → `/import/{id}/start` | Import-Workflow |
| GET | `/api/backup/download/{id}` | **Öffentlich**, per signiertem Token |

## Plattform-Admin (`/api/admin/...`)

⚠️ **Aktuell nur `auth:api`, KEINE Rollenprüfung** – jeder eingeloggte User erreicht diese Routen (siehe [08-kritische-punkte.md](08-kritische-punkte.md)).

| Methode | Route | Beschreibung |
|---|---|---|
| GET | `/stats` / `/tenants` / `/users` / `/bug-reports` | Plattformweite Übersichten |
| PATCH | `/bug-reports/{id}` | Bug-Status/Priorität ändern |
| GET/POST/DELETE | `/serial-numbers` | Seriennummern verwalten |
| POST | `/users/{id}/block` / `unblock` | User sperren/entsperren |

## ⚠️ Temporäre Route (muss entfernt werden)

`GET /api/force-schema-fix` – **öffentliche, nicht authentifizierte** Route, die Unique-Constraints der DB umbaut. Nur als einmaliger Hotfix gedacht. **Nicht verwenden; Entfernung ist Top-Priorität** (siehe 08).

## Konventionen für neue Endpunkte

1. Immer innerhalb der `auth:api` + `SetTenantFromUser` (+ i.d.R. `onboarding.complete`) Gruppe registrieren.
2. `exists:`-Validierungen tenant-scoped schreiben (`Rule::exists(...)->where('tenant_id', ...)`).
3. Beträge als Integer-Cents entgegennehmen und zurückgeben.
4. Für schreibende Mehrschritt-Operationen `DB::transaction()` verwenden.
5. Perspektivisch: API-Versionierung (`/api/v1/...`) einführen, bevor externe Clients (OCR/AI-Services) angebunden werden.
