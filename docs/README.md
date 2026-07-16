# AT-Book – Entwicklerdokumentation

AT-Book ist eine **Multi-Tenant-Buchhaltungsanwendung** (ähnlich Lexware) auf Basis von Laravel 12 + React. Diese Dokumentation ist der zentrale Einstiegspunkt für alle Entwickler und AI-Agents.

> **Wichtig:** Die vielen `*.md`-Dateien im Projekt-Root (z.B. `ALL_FIXES_COMPLETE.md`, `QUICK_FIX_GUIDE.md`, …) sind **historische Arbeitsnotizen** aus der Entwicklungsphase und teilweise veraltet. Verbindlich ist die Dokumentation hier im `docs/`-Ordner, die `CLAUDE.md` sowie die **[STARTUP.md](../STARTUP.md)** (Schnellstart + Test-Logins) im Root.

## Inhaltsverzeichnis

| Dokument | Inhalt |
|---|---|
| [01-uebersicht.md](01-uebersicht.md) | Was ist AT-Book? Features, Tech-Stack, Verzeichnisstruktur |
| [02-architektur.md](02-architektur.md) | Backend-Architektur: Module, Services, Middleware, Auth, Rollen |
| [03-multi-tenancy.md](03-multi-tenancy.md) | Mandantenfähigkeit: Tenant-Auflösung, Datenisolation, Fallstricke |
| [04-datenmodell.md](04-datenmodell.md) | Datenbankschema, Buchhaltungslogik, Belegkreislauf, GoBD |
| [05-api.md](05-api.md) | REST-API-Referenz (alle Endpunkte) |
| [06-frontend.md](06-frontend.md) | React-Frontend: Struktur, Routing, Auth-Handling, UI-Komponenten |
| [07-entwicklung-deployment.md](07-entwicklung-deployment.md) | Lokales Setup (Sail), Tests, Seeder, Produktions-Deployment |
| [08-kritische-punkte.md](08-kritische-punkte.md) | ⚠️ Bekannte Probleme, Sicherheitslücken, Verbesserungsvorschläge (priorisiert) |
| [09-roadmap.md](09-roadmap.md) | Geplante Features: Projekte (Kostenstellen/Kostenträger), OCR, AI |
| [10-verbesserungsplan.md](10-verbesserungsplan.md) | 📋 **Masterplan**: Phasen, Abhängigkeiten, Definition of Done |
| [specs/](specs/README.md) | Umsetzbare Spezifikationen (SPEC-01 … SPEC-10) + **Backup-Schutzregeln** |

## Bestehende Spezialdokumente (weiterhin gültig)

- [TENANT_LOGIC.md](TENANT_LOGIC.md) – Detaillierte Multi-Tenant-Logik (Englisch, mit Diagramm)
- [backup-module.md](backup-module.md) – Backup-/Restore-Modul
- [queue-worker-production.md](queue-worker-production.md) – Queue-Worker in Produktion

## Schnellstart für neue Entwickler

```bash
# 1. Container starten (Laravel Sail, PostgreSQL 18)
./vendor/bin/sail up -d

# 2. Migrationen + Seeder
./vendor/bin/sail artisan migrate --seed

# 3. Frontend-Dev-Server
./vendor/bin/sail npm run dev

# App: http://localhost  |  Vite: Port 5173
```

Details siehe [07-entwicklung-deployment.md](07-entwicklung-deployment.md).

## Die wichtigsten Regeln auf einen Blick

1. **Geldbeträge sind immer Integer in Cents** – niemals Floats für Beträge verwenden.
2. **Jedes mandantenbezogene Model nutzt den Trait `BelongsToTenant`** – dadurch werden alle Queries automatisch auf den aktuellen Tenant gefiltert.
3. **Buchungen (JournalEntries) sind nach dem Festschreiben (`locked_at`) unveränderlich** – Korrekturen nur per Storno (GoBD-Prinzip).
4. **Soll = Haben**: Jede Buchung muss ausgeglichen sein (wird im `BookingService` validiert).
5. **Validierungsregeln wie `exists:accounts,id` müssen tenant-scoped sein** – siehe [08-kritische-punkte.md](08-kritische-punkte.md).
6. Vor größeren Änderungen: [08-kritische-punkte.md](08-kritische-punkte.md) lesen – dort stehen bekannte Schwachstellen, die nicht neu eingebaut werden sollen.
