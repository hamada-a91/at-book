# 🚀 AT-Book starten – Schnellanleitung

> Ausführliche Doku: [docs/README.md](docs/README.md) · Setup-Details: [docs/07-entwicklung-deployment.md](docs/07-entwicklung-deployment.md)

## Start-Sequenz (Entwicklung)

```bash
cd /home/ahmed/LaravelProjects/at-book

# 1. Container starten (App + PostgreSQL)
./vendor/bin/sail up -d

# 2. Datenbank migrieren + Testdaten seeden (idempotent, gefahrlos wiederholbar)
./vendor/bin/sail artisan migrate --seed

# 3. Frontend-Dev-Server (Vite, Port 5173)
./vendor/bin/sail npm run dev

# Optional: Queue-Worker (nötig für Backups!)
# WICHTIG 1: Backup-Jobs laufen auf der Queue "backups" – ohne --queue-Flag
#   verarbeitet der Worker nur "default" und Backups bleiben auf "wartend".
# WICHTIG 2: In der ENTWICKLUNG queue:listen verwenden – queue:work ist ein
#   Daemon, der Code-Änderungen erst nach einem Neustart sieht (Strg+C + neu
#   starten bzw. `sail artisan queue:restart`). queue:listen lädt jeden Job frisch.
./vendor/bin/sail artisan queue:listen --queue=backups,default
```

**App öffnen:** http://localhost

## 🔑 Test-Logins (werden durch `migrate --seed` angelegt)

| Rolle | E-Mail | Passwort | Einstieg |
|---|---|---|---|
| **Demo-Tenant (Owner)** | `demo@at-book.local` | `password` | http://localhost → Login → `/demo-firma/dashboard` |
| **Plattform-Admin** | Wert von `ADMIN_EMAIL` aus `.env` (Default: `admin@at-book.local`) | Wert von `ADMIN_PASSWORD` aus `.env`; wenn leer, wird beim Seeden ein Zufallspasswort **einmalig in der Konsole** angezeigt | `/admin` (Tenants, User, Seriennummern, Bug-Reports) |

Der **Demo-Tenant** (`DemoTenantSeeder`, nur in `local`/`testing`) enthält fertige Testdaten:
SKR03-Kontenplan (47 Konten), Kunde „Muster GmbH“ + Lieferant „Bürobedarf Schmidt KG“ (mit Debitoren-/Kreditorenkonto), 2 Produkte (Laptop mit Lagerbestand 10, IT-Beratung), Bankkonto, 2 Rechnungs-Entwürfe (zum Testen von Buchen/PDF/E-Mail), 1 offener Eingangsbeleg und Journalbuchungen in allen Status (Entwurf / festgeschrieben / storniert).

> ⚠️ Hinweis: In bestehenden Datenbanken kann noch der alte Admin-User (`ahmed.tahhan@web.de`) existieren – dessen Passwort stand früher im Code und sollte geändert werden.

## 📝 Registrierung testen (eigener neuer Tenant)

`ENABLE_SERIAL_NUMBER_ACTIVATION` in der `.env` steuert die Seriennummern-Pflicht bei der Registrierung:

- `false` → einfach unter http://localhost registrieren → Tenant + Owner entstehen, danach Onboarding-Wizard (Firmendaten, Kontenplan-Generierung).
- `true` → zuerst als Plattform-Admin unter `/admin` eine Seriennummer anlegen, dann damit registrieren.

Nach Änderung der `.env`: `./vendor/bin/sail artisan config:clear`.

## 🔧 Troubleshooting

| Problem | Lösung |
|---|---|
| „Vite manifest not found“ | `./vendor/bin/sail npm run dev` läuft nicht → starten (oder `npm run build` für statischen Build) |
| `SQLSTATE … Connection refused` | PostgreSQL-Container fehlt → `./vendor/bin/sail up -d`, dann `./vendor/bin/sail ps` prüfen (es müssen **2** Container laufen: `laravel.test` + `pgsql`) |
| Port belegt | `APP_PORT=8080 ./vendor/bin/sail up -d` oder Vite: `sail npm run dev -- --port 5174` |
| Login schlägt fehl / Rollen fehlen | `./vendor/bin/sail artisan db:seed` (Rollen + Admin + Demo-Tenant, idempotent) |
| Backups bleiben „wartend/pending“ | Queue-Worker **mit Queue-Flag** starten: `./vendor/bin/sail artisan queue:listen --queue=backups,default` (ohne Flag wird nur `default` verarbeitet!) |
| Backup/Import verhält sich wie „alter Code“ | Laufender `queue:work`-Daemon sieht Code-Änderungen nicht → Worker neu starten (`Strg+C` + neu starten oder `sail artisan queue:restart`); in Dev besser `queue:listen` |
| Kompletter Reset | `./vendor/bin/sail artisan migrate:fresh --seed` ⚠️ **löscht alle Daten!** |

## Tests & Code-Style

```bash
./vendor/bin/sail artisan test                    # komplette Suite
./vendor/bin/sail artisan test --filter=Backup    # Backup-Regression (vor jedem Merge!)
vendor/bin/pint --dirty                           # Code-Style
```

## Stoppen

```bash
./vendor/bin/sail down        # Container stoppen (Daten bleiben im Volume)
```
