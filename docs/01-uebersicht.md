# 01 – Projektübersicht

## Was ist AT-Book?

AT-Book ist eine webbasierte **Buchhaltungs- und Warenwirtschafts-App für kleine Unternehmen** (Zielrichtung: deutscher Markt, vergleichbar mit Lexware/lexoffice). Sie ist **mandantenfähig** (Multi-Tenant): Mehrere Firmen nutzen dieselbe Installation, ihre Daten sind strikt getrennt.

### Fachlicher Funktionsumfang (Stand Juli 2026)

| Bereich | Funktionen |
|---|---|
| **Finanzbuchhaltung** | Doppelte Buchführung (Soll/Haben), Buchungsjournal, Festschreiben (GoBD), Storno/Generalumkehr, Kontenplan SKR03 (automatisch generiert nach Geschäftsmodell & Rechtsform), Steuerschlüssel/Tax-Codes |
| **Belege** | Eingangs-/Ausgangsbelege (`belege`-Tabelle) mit Datei-Upload, Belegzeilen, Zahlungsstatus, automatische Verbuchung |
| **Verkaufsprozess** | Angebote (Quotes) → Aufträge (Orders) → Lieferscheine (Delivery Notes) → Rechnungen (Invoices), jeweils mit PDF-Erzeugung (dompdf) und E-Mail-Versand |
| **Rechnungen** | Rechnungsnummernkreis pro Tenant (`RE-JJJJ-NNNN`), automatische Verbuchung (Debitor an Erlöse + USt), Zahlungserfassung |
| **Kontakte** | Kunden/Lieferanten mit automatischen Debitoren-/Kreditorenkonten |
| **Warenwirtschaft** | Produkte, Produktkategorien, Lagerbestand (`inventory_transactions`), automatische Bestandsminderung beim Rechnungsbuchen, Inventurbericht |
| **Berichte** | Summen- und Saldenliste (Trial Balance), GuV (P&L), Bilanz, Journalexport, Kontobewegungen, USt-Bericht |
| **Banken** | Bankkonten-Verwaltung mit Zuordnung zu Sachkonten |
| **Administration** | Benutzer & Rollen (Spatie Permission), Onboarding-Wizard, Firmeneinstellungen, Bug-Reports, Backup/Restore pro Tenant, Seriennummern-Aktivierung, User-Blocking |

### Geplant (siehe [09-roadmap.md](09-roadmap.md))

- Projekte mit **Kostenstellen und Kostenträgern**
- **OCR** für Belege (automatische Buchungsvorschläge)
- **AI-Integration** (Buchungsassistent)
- **Berichte 2.0 & Steuerzentrale** mit BWA, Exporten und stufenweiser ELSTER-Anbindung (SPEC-11, vor OCR/AI priorisiert)

## Tech-Stack

### Backend
| Komponente | Technologie |
|---|---|
| Framework | Laravel 12 (PHP ≥ 8.2, Sail-Runtime PHP 8.4) |
| Datenbank | PostgreSQL 18 (Single Database, Shared Schema Multi-Tenancy) |
| Auth | JWT via `tymon/jwt-auth` (Guard `api`), TTL 7 Tage; `laravel/sanctum` ist installiert, aber JWT ist der aktive Mechanismus |
| Berechtigungen | `spatie/laravel-permission` (Guard `api`, teams=false) |
| PDF | `barryvdh/laravel-dompdf` |
| Queue | Laravel Queue mit `database`-Driver (Queues: `backups`, `default`) |
| Tests | PHPUnit 11 |

### Frontend
| Komponente | Technologie |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 7 (`laravel-vite-plugin`) |
| Styling | Tailwind CSS 4, shadcn/ui-Muster (Radix UI Primitives, `class-variance-authority`, `cmdk`) |
| Routing | React Router 7 (Pfadschema `/{tenant-slug}/{resource}`) |
| Server-State | TanStack React Query 5 |
| Client-State | Zustand |
| Formulare | react-hook-form + zod |
| Charts | Recharts |

### Infrastruktur
- **Entwicklung:** Laravel Sail (`compose.yaml`): Container `laravel.test` + `pgsql`
- **Produktion:** `compose.production.yaml`: App-Container (nginx + php-fpm + supervisord aus `docker/production/`), separater Queue-Worker-Container, PostgreSQL

## Verzeichnisstruktur (relevante Teile)

```
at-book/
├── app/
│   ├── Console/Commands/        # z.B. ResetOnboarding
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Api/             # Alle REST-Controller (Invoice, Beleg, Journal, …)
│   │   │   ├── Api/Admin/       # Plattform-Admin (SerialNumbers)
│   │   │   ├── Auth/            # Login, Registration (JWT)
│   │   │   └── Concerns/        # HasTenantScope (Controller-Helper)
│   │   └── Middleware/          # SetTenantFromUser, OnboardingMiddleware, …
│   ├── Jobs/                    # ProcessBackupExportJob / -ImportJob
│   ├── Mail/                    # SendDocumentMail (Angebote/Rechnungen per Mail)
│   ├── Models/                  # "Flache" Models (Invoice, Beleg, Product, Tenant, …)
│   │   └── Concerns/            # BelongsToTenant, HasPublicId (Traits)
│   ├── Modules/                 # Modul-Ansatz (nur teilweise durchgezogen!)
│   │   ├── Accounting/          # JournalEntry, Account, BookingService, AuditLog
│   │   ├── Contacts/            # Contact
│   │   └── Documents/           # Document
│   ├── Services/                # InventoryService, Skr03AccountPlanGenerator,
│   │   └── Backup/              # Export/Import inkl. Transformer pro Entity
│   └── helpers.php              # Globale tenant()-Helper-Funktion
├── database/
│   ├── migrations/              # ⚠️ enthält historisch gewachsene Duplikate
│   └── seeders/                 # AccountSeeder, RolePermissionSeeder, AdminUserSeeder, …
├── resources/
│   ├── js/                      # React-App (SPA), Einstieg: app.tsx
│   │   ├── pages/               # Seiten (1 Datei pro Screen)
│   │   ├── components/          # Wiederverwendbare Komponenten + ui/ (shadcn)
│   │   ├── lib/                 # axios, api, currency, utils
│   │   └── services/            # API-Service-Layer (bisher nur teilweise genutzt)
│   └── views/                   # Blade nur für PDF-Templates (invoices, quotes, orders)
├── routes/
│   ├── api.php                  # Alle API-Routen (⚠️ enthält temporäre Fix-Route)
│   └── web.php                  # SPA-Catch-All
├── docs/                        # ← Diese Dokumentation
├── compose.yaml                 # Sail (Entwicklung)
├── compose.production.yaml      # Produktion (⚠️ enthält hartcodierte Secrets, siehe 08)
└── docker/production/           # Produktions-Dockerfile, nginx, supervisord
```

## Wichtige Konventionen

1. **Beträge in Cents** (Integer/BigInteger). Umrechnung im Frontend über `resources/js/lib/currency.ts`.
2. **Deutsch als Domänensprache:** Fachbegriffe wie `Beleg`, `belege`-Tabelle, „Soll/Haben“ (als `debit`/`credit` gespeichert), Status-Texte teils deutsch. Code/Kommentare gemischt Deutsch/Englisch.
3. **`public_id` (UUID)** auf allen Tenant-Models (`HasPublicId`-Trait) – gedacht für externe Referenzen/Backups; interne Routen nutzen aktuell noch numerische IDs.
4. **Soft Deletes** auf buchhaltungsrelevanten Tabellen (`journal_entries`, `belege`) – gebuchte Daten werden nie hart gelöscht.
