# CLAUDE.md – AT-Book

Multi-Tenant-Buchhaltungs-App (ähnlich Lexware) für den deutschen Markt. **Laravel 12 + PostgreSQL 18 (Sail/Docker) Backend, React 18 + TypeScript SPA Frontend.**

## 📚 Verbindliche Dokumentation

Vollständige Doku in **`docs/`** (auf Deutsch): [docs/README.md](docs/README.md) ist der Index.
- Architektur: `docs/02-architektur.md` · Multi-Tenancy: `docs/03-multi-tenancy.md` · Datenmodell/GoBD: `docs/04-datenmodell.md` · API: `docs/05-api.md`
- **Vor Änderungen lesen: `docs/08-kritische-punkte.md`** (bekannte Sicherheits-/Korrektheitsprobleme, priorisiert)
- Geplante Features (Projekte/Kostenstellen, OCR, AI): `docs/09-roadmap.md`
- **Arbeitsplan: `docs/10-verbesserungsplan.md`** + Specs in `docs/specs/` (SPEC-01…10). Bei jeder Schema-Änderung gelten die **Backup-Schutzregeln** in `docs/specs/README.md` – das Backup-Modul (`app/Services/Backup/`) darf nie brechen: Transformer erweitern, alte Backups importierbar halten, `test --filter=Backup` vor jedem Merge.

⚠️ Die vielen `*.md`-Dateien im Root (ALL_FIXES_COMPLETE.md etc.) sind veraltete Arbeitsnotizen – ignorieren. **Ausnahme:** `STARTUP.md` (aktueller Schnellstart inkl. Test-Logins) und `README.md`.

## Befehle

```bash
./vendor/bin/sail up -d                # Container starten (App + pgsql)
./vendor/bin/sail artisan migrate --seed
./vendor/bin/sail npm run dev          # Vite (Port 5173)
./vendor/bin/sail artisan test         # PHPUnit
./vendor/bin/sail artisan queue:work   # nötig für Backups
vendor/bin/pint                        # Code-Style
```

Alle PHP/Node-Befehle laufen **im Sail-Container** (`sail artisan`, `sail npm`, `sail composer`).

## Architektur-Kurzfassung

- **SPA + REST-API**: `routes/api.php` → Middleware `auth:api` (JWT, tymon/jwt-auth) → `SetTenantFromUser` → `onboarding.complete` → Controller in `app/Http/Controllers/Api/`.
- **Multi-Tenancy**: Single DB, shared schema. Trait `BelongsToTenant` (Global Scope über `tenant()`-Helper aus `app/helpers.php`). Der Tenant kommt **vom eingeloggten User**, nie vom URL-Slug.
- **Buchhaltung**: `app/Modules/Accounting/` – `BookingService` (Soll=Haben-Validierung, GoBD-Lock via `locked_at`, Storno per Generalumkehr). Journal = `journal_entries` + `journal_entry_lines`.
- **Belegkette**: Quote → Order → DeliveryNote → Invoice → JournalEntry (+ Lagerabgang via `InventoryService`).
- **Rollen**: spatie/laravel-permission, Guard `api` (owner, manager, cachier, buchhalter, admin).
- Module-Struktur (`app/Modules/`) nur teilweise umgesetzt; die meisten Models liegen in `app/Models/`.

## Harte Regeln

1. **Geldbeträge = Integer in Cents.** Nie Floats. Frontend-Formatierung über `resources/js/lib/currency.ts`.
2. **Jedes neue Tenant-Model**: `use BelongsToTenant, HasPublicId;` + Migration mit `tenant_id` (FK, **mit Index**) + zusammengesetzte Uniques `unique(['tenant_id', 'code'])`. Nie auf `User` anwenden.
3. **`exists:`-Validierung immer tenant-scoped**: `Rule::exists('accounts','id')->where('tenant_id', tenant()->id)` – nacktes `exists:accounts,id` erlaubt Cross-Tenant-Referenzen (bekannte Lücke, nicht neu einbauen!).
4. **GoBD**: Buchungen mit `locked_at` nie ändern/löschen – nur `reverseBooking()` (Storno). Soft Deletes beibehalten.
5. **Mehrschritt-Schreiboperationen in `DB::transaction()`** (Bestandscode verletzt das teils – nicht kopieren).
6. In **Jobs/Commands/Tinker ist `tenant()` null** → Global Scope greift nicht; Tenant-Kontext explizit setzen: `app()->instance('currentTenant', $tenant)`.
7. Neue Entities brauchen einen **Backup-Transformer** (`app/Services/Backup/Transformers/` + Registrierung in `EntityTransformerRegistry`), sonst bricht Export/Import.
8. Frontend: API-Calls über die axios-Instanz `resources/js/lib/axios.ts`; React Query für Server-State; Routen führen den Tenant-Slug (`/{tenant}/{resource}`).
9. Domänensprache Deutsch (Beleg, Soll/Haben als debit/credit), UI-Texte Deutsch.

## Bekannte Fallen (Kurzliste, Details in docs/08)

- `GET /api/force-schema-fix` ist eine öffentliche Altlast in `routes/api.php` → soll entfernt werden, nicht nachahmen.
- `/api/admin/*` hat noch **keine** Rollenprüfung.
- `compose.production.yaml` enthält hartcodierten APP_KEY + APP_DEBUG=true (Rotation ausstehend).
- `InvoiceController::book()` bucht ohne Transaktion und ohne `locked_at`; USt-Konto `1776` hartcodiert.
- Rechnungsnummern (`RE-JJJJ-NNNN`) per „max+1“ ohne Lock → Race Condition.
- Tote Dateien: `Api/InvoiceController_PDF_SNIPPET.php`, `Api/InvoiceController_UPDATE.php`, `Onboarding.tsx.broken`, `debug_*.php`.
- PHPUnit-Abdeckung minimal – neue Features immer mit Feature-Test (v.a. Tenant-Isolation).
