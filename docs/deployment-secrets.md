# Produktions-Secrets: Rotation & Deployment

**Hintergrund:** `compose.production.yaml` enthielt bis SPEC-01 einen hartcodierten `APP_KEY` im Klartext (committed in der Git-Historie). Dieser Key gilt ab sofort als **kompromittiert** und darf in Produktion nicht mehr verwendet werden — auch nicht nach diesem Fix, da er weiterhin in alten Commits einsehbar ist.

Seit SPEC-01 lesen `at-book` und `queue` in `compose.production.yaml` `APP_KEY`, `JWT_SECRET` und `APP_DEBUG` aus der Server-Umgebung (`${APP_KEY}`, `${JWT_SECRET}`). Es befinden sich **keine** Secrets mehr im Repository. Die eigentlichen Werte müssen manuell auf dem Server gesetzt werden.

## Manuelle Schritte auf dem Server

1. **Neuen `APP_KEY` generieren** (im Projektverzeichnis auf dem Server, oder lokal mit identischer Laravel-Version):
   ```bash
   php artisan key:generate --show
   ```
   Der Befehl gibt den Key aus, ohne ihn in eine Datei zu schreiben (`--show`). Verändert **nicht** die lokale `.env`.

2. **Neuen `JWT_SECRET` generieren** — eine der beiden Varianten:
   ```bash
   php artisan jwt:secret --show
   # oder
   openssl rand -base64 32
   ```

3. **Beide Werte in eine `.env.production` auf dem Server eintragen** (diese Datei wird **nicht** committet, liegt nur auf dem Produktionsserver, z. B. neben `compose.production.yaml`):
   ```env
   APP_KEY=base64:...
   JWT_SECRET=...
   DB_DATABASE=...
   DB_USERNAME=...
   DB_PASSWORD=...
   ```
   Beim Start mit `docker compose -f compose.production.yaml --env-file .env.production up -d` (oder äquivalent) werden die Platzhalter `${APP_KEY}` / `${JWT_SECRET}` in `compose.production.yaml` daraus befüllt.

4. **Container neu starten**, damit die neuen Werte greifen:
   ```bash
   docker compose -f compose.production.yaml --env-file .env.production up -d --force-recreate
   ```

## Auswirkungen der Rotation

- **`APP_KEY`-Rotation:** Alle verschlüsselten Laravel-Cookies/Sessions werden ungültig. Aktuell gibt es keine bekannten verschlüsselten Datenbankfelder, die mit dem alten Key entschlüsselt werden müssten — nur Sessions/Cookies sind betroffen und verfallen automatisch.
- **`JWT_SECRET`-Rotation:** Alle bestehenden JWT-Tokens (Login-Sessions) werden ungültig. **Alle Nutzer müssen sich nach der Rotation neu einloggen.** Dies sollte kurz vorher angekündigt werden (z. B. Wartungsfenster).
- **Alter `APP_KEY` in der Git-Historie:** Der bisherige Key (`base64:9KVD+I4etlRv3C/QBAPQWv6shR6xeqx9MSBWHrItd8w=`) ist über die Commit-Historie weiterhin einsehbar und gilt dauerhaft als kompromittiert, auch nach der Rotation. Er darf nie wieder produktiv verwendet werden.

## Checkliste

- [ ] Neuer `APP_KEY` generiert und in `.env.production` (Server) hinterlegt
- [ ] Neuer `JWT_SECRET` generiert und in `.env.production` (Server) hinterlegt
- [ ] `.env.production` liegt **nicht** im Git-Repository (`.gitignore` prüfen)
- [ ] Nutzer über bevorstehenden Neu-Login informiert
- [ ] Container mit neuen Werten neu gestartet
- [ ] Nach Neustart: Login-Flow und ein Admin-Endpoint (`/api/admin/stats`) manuell getestet
