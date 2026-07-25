# 07 – Entwicklung & Deployment

## Lokale Entwicklung (Laravel Sail)

### Voraussetzungen
Docker + Docker Compose (WSL2 unter Windows). Alles Weitere läuft in Containern.

### Erststart

```bash
# Abhängigkeiten (falls vendor/ fehlt, via Docker-Composer):
docker run --rm -v $(pwd):/var/www/html -w /var/www/html \
  laravelsail/php84-composer:latest composer install --ignore-platform-reqs

cp .env.example .env          # dann DB_CONNECTION=pgsql, DB_HOST=pgsql, DB_DATABASE=at-book, DB_USERNAME=sail setzen
./vendor/bin/sail up -d
./vendor/bin/sail artisan key:generate
./vendor/bin/sail artisan jwt:secret
./vendor/bin/sail artisan migrate --seed
./vendor/bin/sail artisan storage:link
./vendor/bin/sail npm install
./vendor/bin/sail npm run dev
```

App: **http://localhost** · Vite-HMR: Port 5173 · PostgreSQL: Port 5432 (User `sail`).

Alternativ existieren die Skripte `fresh-install.sh` und `setup-multi-tenant.sh` (Reset + Neuaufsetzen inkl. Seeder) – vor Benutzung Inhalt prüfen, sie löschen Daten.

### Container (compose.yaml)
| Service | Inhalt |
|---|---|
| `laravel.test` | PHP 8.4 (Sail-Runtime), Ports 80 + 5173 |
| `pgsql` | PostgreSQL 18-alpine, Volume `sail-pgsql` |

### Nützliche Befehle

```bash
sail artisan migrate               # Migrationen
sail artisan db:seed               # Seeder (Accounts, Rollen, Admin-User, CompanySettings)
sail artisan queue:work --queue=backups,default   # Queue-Worker (nötig für Backups! Ohne --queue-Flag läuft nur "default")
sail artisan tinker                # REPL (Achtung: tenant() ist hier null!)
sail artisan onboarding:reset      # Onboarding zurücksetzen (Custom Command)
sail composer dev                  # Server + Queue + Logs + Vite parallel
sail artisan test                  # Tests
vendor/bin/pint                    # Code-Style (Laravel Pint)
```

### Seeder-Überblick
`sail artisan migrate --seed` führt den `DatabaseSeeder` aus: Rollen + Admin immer, Demo-Tenant nur in `local`/`testing`.

| Seeder | Inhalt |
|---|---|
| `RolePermissionSeeder` | Rollen `owner`, `manager`, `cachier`, `buchhalter`, `admin` + Permissions (Guard `api`) |
| `AdminUserSeeder` | Plattform-Admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD` aus `.env`, sonst Zufallspasswort mit Konsolen-Ausgabe) |
| `DemoTenantSeeder` | **Kompletter Test-Tenant** (nur lokal): Login `demo@at-book.local` / `password`, Slug `demo-firma` – SKR03-Konten, Kunde+Lieferant mit Personenkonten, Produkte mit Lagerbestand, Bankkonto, Rechnungs-Drafts, Buchungen (draft/festgeschrieben/storniert), Eingangsbeleg |
| `AccountSeeder` | Basis-Kontenplan (Altbestand, wird vom Demo-Seeder nicht genutzt) |

Registrierung testen: `ENABLE_SERIAL_NUMBER_ACTIVATION` steuert die Seriennummern-Pflicht (Config `atbook.serial_number_activation` – immer über `config()` abfragen, nie `env()` direkt!).

## Tests

- PHPUnit 11, Konfiguration in `phpunit.xml`.
- Vorhandene Feature-Tests: `TenantIsolationTest`, `BackupTest`, `NeutralContactTest` – **die Abdeckung ist sehr gering** (keine Tests für BookingService, Rechnungsbuchung, Reports!). Neue Features bitte immer mit Feature-Test, insbesondere:
  1. Tenant-Isolation (fremde Daten weder lesbar noch referenzierbar),
  2. Soll=Haben-Invariante,
  3. GoBD-Regeln (kein Ändern nach `locked_at`).

```bash
sail artisan test                      # alle Tests
sail artisan test --filter=TenantIsolationTest
```

## Produktion

### Setup (`compose.production.yaml` + `docker/production/`)

| Service | Inhalt |
|---|---|
| `at-book` | App-Container: nginx + php-fpm via supervisord (`docker/production/`), Port 127.0.0.1:8081 (Reverse Proxy davor, Domain `at-book.vorpoint.de`) |
| `queue` | Gleiches Image, `php artisan queue:work --queue=backups,default --tries=3 --timeout=90` |
| `pgsql` | PostgreSQL 18, Volume `db-data` |

Deployment-Skript: `production-deploy.sh`; deutsche Anleitung: `DEPLOYMENT_GUIDE_GERMAN.md` (Root). Queue-Details: [queue-worker-production.md](queue-worker-production.md).

### ⚠️ Bekannte Deployment-Probleme (Details in 08)
1. **`APP_KEY` ist hartcodiert in `compose.production.yaml` und im Git-Repo** → Key rotieren und in `.env`/Secrets auslagern!
2. **`APP_DEBUG: 'true'` in Produktion** → muss `false` sein (Debug-Seiten leaken Konfiguration).
3. Der gesamte Projektordner ist als Volume gemountet (`.:/var/www/html`) – kein echtes Immutable-Image-Deployment.
4. Kein automatisches `migrate`/`config:cache` im Startprozess dokumentiert.
5. Keine Backup-Strategie für das `db-data`-Volume (DB-Dumps) beschrieben.

### Empfohlener Deploy-Ablauf (bis auf Weiteres manuell)

```bash
git pull
docker compose -f compose.production.yaml build
docker compose -f compose.production.yaml up -d
docker compose -f compose.production.yaml exec at-book php artisan migrate --force
docker compose -f compose.production.yaml exec at-book php artisan config:cache route:cache view:cache
docker compose -f compose.production.yaml exec at-book npm run build   # falls Assets nicht im Image
```

## Aufräum-Hinweis für das Repo

Im Root liegen Debug-/Wegwerf-Dateien (`debug_*.php`, `debug-inventory.php`, `booking_test.json`, `replace-bookingcreate.sh`, diverse einmalige `setup-*.sh`) und ~30 historische MD-Notizen. Empfehlung: in einen `archive/`-Ordner verschieben oder löschen – sie verwirren neue Entwickler und AI-Agents (siehe 08, Punkt „Repo-Hygiene“).
