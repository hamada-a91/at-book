# SPEC-01 – Sicherheits-Hotfixes (P0)

**Phase:** 0 · **Aufwand:** ~1 Tag · **Abhängigkeiten:** keine · **Behebt:** 08/Punkte 1, 2, 3, 5 (Teil)

## Ziel
Die vier akuten Sicherheitslücken schließen. Keine Schema-Änderungen, kein Backup-Risiko.

## Umfang

### 1.1 `force-schema-fix`-Route entfernen
- `routes/api.php`: kompletten Block `Route::get('/force-schema-fix', …)` (Zeilen ~7–54) löschen, inkl. der `Schema`-Imports, die dann ungenutzt sind.
- Datei `routes/schema_fix.php` löschen (wird nirgends geladen, reine Altlast).
- Verifizieren: `curl http://localhost/api/force-schema-fix` → 404.

### 1.2 Rollenprüfung auf Admin-Routen
- `routes/api.php`: Admin-Gruppe ändern zu
  ```php
  Route::middleware(['auth:api', 'role:admin,api'])->prefix('admin')->group(…);
  ```
  (Spatie-`RoleMiddleware`; Alias `role` in `bootstrap/app.php` registrieren, falls noch nicht geschehen.)
- Sicherstellen, dass der `AdminUserSeeder`-User die Rolle `admin` (Guard `api`) trägt.
- Frontend: `AdminDashboard` zeigt bei 403 eine saubere Fehlermeldung / blendet Admin-Navigation für Nicht-Admins aus (`user.roles` kommt bereits über `/api/user`).

### 1.3 Produktions-Secrets
- Neuen `APP_KEY` generieren (`php artisan key:generate --show`).
- `compose.production.yaml`: beide hartcodierten `APP_KEY`-Einträge ersetzen durch `APP_KEY: '${APP_KEY}'`; Wert kommt aus einer **nicht committeten** `.env.production` auf dem Server.
- `APP_DEBUG: 'false'` in beiden Services setzen.
- `JWT_SECRET` ebenfalls per Env injizieren und rotieren (Achtung: invalidiert alle Sessions → Nutzer müssen sich neu einloggen; kurz ankündigen).
- Der alte Key bleibt in der Git-Historie → als kompromittiert behandeln. Nach Rotation prüfen, ob verschlüsselte Felder existieren, die mit dem alten Key entschlüsselt werden müssten (aktuell: keine bekannt; Sessions/Cookies verfallen einfach).

### 1.4 Frontend-Token-Hygiene (Quickfix)
- `resources/js/app.tsx`: `console.log('🔐 Attaching auth token …')` entfernen.
- Kein weiterer Umbau in dieser Spec (localStorage→Cookie ist bewusst ausgeklammert, siehe 08/P0-5 – separates Paket nach Phase 2).

## Akzeptanzkriterien
- [ ] `GET /api/force-schema-fix` → 404
- [ ] `GET /api/admin/stats` als normaler Tenant-User → **403**; als Admin → 200 (Feature-Test!)
- [ ] `compose.production.yaml` enthält keine Klartext-Secrets mehr (`git grep 'base64:'` leer)
- [ ] Produktion läuft mit `APP_DEBUG=false` (Fehlerseite zeigt keinen Stacktrace)
- [ ] Browser-Konsole loggt keine Token-Meldungen mehr

## Backup-Impact
Keiner (keine Schema-/Datenänderung). ✅

## Tests
`tests/Feature/AdminAccessTest.php`: Nicht-Admin → 403 auf alle `/api/admin/*`-Routen; Admin → 200; nicht eingeloggt → 401.
