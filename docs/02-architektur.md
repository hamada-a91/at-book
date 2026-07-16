# 02 – Backend-Architektur

## Gesamtbild

AT-Book ist eine klassische **SPA + REST-API**-Architektur:

```
Browser (React SPA)
   │  JWT im Authorization-Header (Bearer)
   ▼
routes/api.php  ──►  Middleware-Kette:
                     api → auth:api (JWT) → SetTenantFromUser → [onboarding.complete]
   ▼
Controller (app/Http/Controllers/Api/*)
   ▼
Services (BookingService, InventoryService, Backup*, Skr03AccountPlanGenerator)
   ▼
Eloquent Models (mit BelongsToTenant-Global-Scope)
   ▼
PostgreSQL (eine DB, alle Tenants, tenant_id-Spalte)
```

`routes/web.php` liefert nur die SPA aus (Catch-All auf die React-App). Blade-Views existieren ausschließlich für PDF-Rendering (dompdf).

## Modul-Struktur (teilweise umgesetzt)

Es gibt einen begonnenen **Modul-Ansatz** unter `app/Modules/`:

| Modul | Inhalt |
|---|---|
| `Modules/Accounting` | `JournalEntry`, `JournalEntryLine`, `Account`, `AuditLog` (Models) + `BookingService` |
| `Modules/Contacts` | `Contact` |
| `Modules/Documents` | `Document` (Dokumenten-Metadaten) |

**Achtung:** Der Großteil der Models liegt „flach“ in `app/Models/` (Invoice, Beleg, Quote, Order, Product, …). Die Modul-Struktur wurde nicht konsequent durchgezogen. **Empfehlung für neue Features:** Entweder konsequent als Modul anlegen (z.B. `Modules/Projects` für Kostenstellen/Kostenträger) oder die Modul-Struktur bewusst auflösen – nicht weiter mischen (siehe [08-kritische-punkte.md](08-kritische-punkte.md)).

## Authentifizierung & Autorisierung

### JWT-Flow
1. `POST /api/register` – legt **Tenant + Owner-User** an (Registrierung erzeugt einen neuen Mandanten).
2. `POST /api/login` – gibt JWT zurück (`tymon/jwt-auth`, Guard `api`, TTL 10080 Min = 7 Tage). Custom Claims: `tenant_id`, `email`.
3. Frontend speichert Token in `localStorage` (`auth_token`) und hängt ihn per globalem fetch-Interceptor/axios an alle `/api`-Requests.
4. `GET /api/user` liefert den eingeloggten User, `POST /api/logout` invalidiert das Token.

Guards (`config/auth.php`): `web` (session, ungenutzt für die API) und `api` (jwt). **Alle API-Routen nutzen `auth:api`.**

### Rollen & Berechtigungen (Spatie)
- Guard: `api`, `teams=false` (Rollen sind global definiert, aber pro User zugewiesen – Users gehören zu genau einem Tenant, daher faktisch tenant-isoliert).
- Rollen aus `RolePermissionSeeder`: **`owner`**, **`manager`**, **`cachier`** (sic, Tippfehler für "cashier"), **`buchhalter`**, **`admin`** (Plattform-Admin).
- Permissions granular (`user.view`, `invoice.create`, …), aber **in Controllern kaum geprüft** – aktuell wird fast nur `hasRole('owner')` im `UserController` und `hasRole('admin')` beim Login verwendet. Die `/api/admin/*`-Routen prüfen **gar keine** Rolle (kritisch! → [08-kritische-punkte.md](08-kritische-punkte.md)).

### Middleware

| Middleware | Zweck |
|---|---|
| `SetTenantFromUser` | Lädt `$user->tenant` und bindet ihn als `app()->instance('currentTenant', …)`. Grundlage für den `tenant()`-Helper und die Global Scopes. |
| `OnboardingMiddleware` (Alias `onboarding.complete`) | Blockiert Fach-Routen (403 + Redirect-Hinweis), solange `company_settings.onboarding_completed` false ist. |
| `SetTenantFromPath` | Existiert, wird aktuell **nicht** in `routes/api.php` verwendet (URL-Slug wird backendseitig bewusst nicht vertraut). |
| `ForceJsonResponse` | Erzwingt JSON-Antworten. |

## Services (Geschäftslogik)

### `Modules/Accounting/Services/BookingService` – Herzstück der Buchhaltung
- `createBooking(array $data)`: validiert **Soll = Haben** (Summenvergleich in Cents), erzeugt `JournalEntry` (Status `draft`, `batch_id` = UUID) + `JournalEntryLine`s in einer DB-Transaktion. Setzt verknüpften Beleg auf `booked`.
- `lockBooking(int $id)`: **GoBD-Festschreibung** – setzt `status='posted'` und `locked_at`. Danach unveränderlich.
- `reverseBooking(int $id)`: **Storno/Generalumkehr** – repliziert die Buchung mit getauschten Soll/Haben-Seiten, Original wird `cancelled`.

### `Services/Skr03AccountPlanGenerator`
Generiert beim Onboarding den SKR03-Kontenplan: Basis-Konten + geschäftsmodellspezifische Konten (z.B. Handel, Dienstleistung) + rechtsformspezifische Konten (z.B. GmbH-Eigenkapitalkonten). Kann bestehende Pläne um fehlende Konten **erweitern** (`/api/account-plan/extend`).

### `Services/InventoryService`
Lagerbuchungen (`inventory_transactions`): `addStock`/`removeStock` mit Referenz auf das auslösende Dokument. Wird u.a. beim Buchen einer Rechnung aufgerufen (Bestandsminderung bei Produkten mit Bestandsführung).

### `Services/Backup/*`
Tenant-vollständiger Export/Import als JSON:
- `BackupExportService`/`BackupImportService` + je ein **Transformer pro Entity** (`Transformers/*Transformer.php`, registriert in `EntityTransformerRegistry`). Referenzen zwischen Entities laufen über `public_id` (UUID), Mapping beim Import via `DTO/ImportIdMapping`.
- Asynchron über `ProcessBackupExportJob` / `ProcessBackupImportJob` (Queue `backups`), Statusverfolgung in `backup_jobs`, Audit in `backup_audit_logs`. Download über signierte Token-Route ohne Auth.
- Details: [backup-module.md](backup-module.md)

## Automatische Buchungslogik (Rechnung → Journal)

`InvoiceController::book()` erzeugt beim Buchen einer Rechnung:

```
Soll  : Debitorenkonto des Kunden (contact.customer_account_id)  → Bruttobetrag
Haben : Erlöskonten (aus den Rechnungszeilen, gruppiert nach Konto+Steuersatz) → Netto
Haben : USt-Konto (hartcodiert Code '1776', Fallback '177%')     → Steuerbetrag
```

Anschließend: Invoice-Status → `booked`, `journal_entry_id` gesetzt, Lagerbestand reduziert.
⚠️ Diese Methode läuft aktuell **ohne DB-Transaktion** und der Journal-Eintrag wird als `posted` ohne `locked_at` angelegt – siehe [08-kritische-punkte.md](08-kritische-punkte.md).

`recordPayment()` bucht analog `Kasse/Bank an Debitor`.

## Wichtige Traits

| Trait | Datei | Zweck |
|---|---|---|
| `BelongsToTenant` | `app/Models/Concerns/BelongsToTenant.php` | Global Scope `where tenant_id = tenant()->id` + Auto-Set beim Erstellen. **Pflicht für jedes neue Tenant-Model.** |
| `HasPublicId` | `app/Models/Concerns/HasPublicId.php` | UUID `public_id` bei Erstellung; `findByPublicId()`. Wird vom Backup-Modul für stabile Referenzen genutzt. |
| `HasTenantScope` | `app/Http/Controllers/Concerns/HasTenantScope.php` | Controller-Helper: `getTenantOrFail()` (401/403 mit Logging), `scopeToTenant($query)`. |

## Hintergrundjobs & Queue

- Queue-Driver: `database` (Tabelle `jobs`), Queues: `backups`, `default`.
- In Produktion läuft ein eigener Container: `php artisan queue:work --queue=backups,default --tries=3 --timeout=90`.
- In der Sail-Entwicklung muss der Worker manuell gestartet werden: `sail artisan queue:work` (oder `composer dev`, das `queue:listen` mitstartet).

## E-Mail

`SendDocumentMail` versendet Angebote/Aufträge/Rechnungen als PDF-Anhang. Lokal: `MAIL_MAILER=log` (Mails landen im Laravel-Log).
