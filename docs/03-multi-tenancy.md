# 03 – Multi-Tenancy (Mandantenfähigkeit)

> Ausführliche englische Version mit Diagramm: [TENANT_LOGIC.md](TENANT_LOGIC.md)

## Ansatz: Single Database, Shared Schema

Alle Mandanten (Tenants) teilen sich **eine Datenbank und dieselben Tabellen**. Die Isolation erfolgt über eine `tenant_id`-Spalte + Eloquent Global Scopes. Es gibt **keine** separaten Datenbanken oder Schemas pro Tenant.

```
tenants (id, public_id, name, slug)
   └── users (tenant_id, …)            ← KEIN Global Scope (Login muss tenant-übergreifend funktionieren)
   └── accounts, journal_entries, contacts, invoices, belege,
       bank_accounts, company_settings, tax_codes, products,
       quotes, orders, delivery_notes, … (alle mit tenant_id + BelongsToTenant-Trait)
```

## Tenant-Auflösung

### Backend: Der User bestimmt den Tenant (Sicherheitsgrenze)
1. Request kommt mit JWT (`Authorization: Bearer …`).
2. `auth:api` lädt den User.
3. Middleware **`SetTenantFromUser`** bindet `$user->tenant` in den Container: `app()->instance('currentTenant', $tenant)`.
4. Der globale Helper **`tenant()`** (in `app/helpers.php`) gibt diesen Tenant zurück (oder `null`).

**Der URL-Slug wird backendseitig NICHT vertraut.** Selbst wenn ein User die Frontend-URL auf `/andere-firma/dashboard` ändert, liefert die API nur Daten seines eigenen Tenants.

### Frontend: URL-Slug nur für Navigation
React-Routen folgen dem Muster `/{tenant_slug}/{resource}` (z.B. `/acme-gmbh/invoices`). Der Slug dient nur der Navigation/Anzeige – alle internen Links müssen ihn mitführen.

## Datenisolation: Trait `BelongsToTenant`

```php
// app/Models/Concerns/BelongsToTenant.php
static::addGlobalScope('tenant', function (Builder $builder) {
    if ($tenant = tenant()) {
        $builder->where('tenant_id', $tenant->id);
    }
});

static::creating(function (Model $model) {
    if (!$model->tenant_id && $tenant = tenant()) {
        $model->tenant_id = $tenant->id;
    }
});
```

**Regeln:**
- Jedes neue Tenant-Model **muss** `use BelongsToTenant;` bekommen und eine Migration mit `tenant_id` (FK auf `tenants`, `cascadeOnDelete`).
- **Niemals** auf das `User`-Model anwenden (Login wäre sonst unmöglich).
- Unique-Constraints müssen **zusammengesetzt** sein: `unique(['tenant_id', 'code'])` statt `unique('code')` – das wurde bei `accounts`, `tax_codes`, `invoices`, `belege` nachträglich per Fix-Migration korrigiert.

## Registrierung = Tenant-Erstellung

`POST /api/register` (RegistrationController) legt an:
1. neuen `Tenant` (Slug wird automatisch aus dem Namen generiert, `Tenant::generateSlug()`),
2. den ersten `User` mit Rolle `owner`,
3. JWT für den direkten Login.

Danach durchläuft der Owner das **Onboarding** (Firmendaten, Geschäftsmodell, Rechtsform → SKR03-Kontenplan-Generierung). Erst nach `onboarding_completed = true` sind die Fach-Routen freigeschaltet (`OnboardingMiddleware`).

## Bekannte Fallstricke (unbedingt lesen!)

1. **`exists:`-Validierungen umgehen den Global Scope.** `'account_id' => 'exists:accounts,id'` prüft gegen die *ganze* Tabelle, nicht nur den eigenen Tenant. Ein User kann so IDs fremder Tenants referenzieren. Richtig:
   ```php
   use Illuminate\Validation\Rule;
   'account_id' => [Rule::exists('accounts', 'id')->where('tenant_id', tenant()->id)],
   ```
   Betroffene Stellen siehe [08-kritische-punkte.md](08-kritische-punkte.md).

2. **`journal_entry_lines` hat keine eigene `tenant_id`** – die Isolation läuft nur über den Parent (`journal_entries`). Bei direkten Queries auf Lines (z.B. Reports) immer über den Parent joinen/filtern.

3. **Kontext außerhalb von HTTP-Requests:** In Jobs, Commands und Tinker ist `tenant()` `null` → Global Scope filtert **nicht** (alle Tenants sichtbar!) und `tenant_id` wird beim Erstellen nicht gesetzt. Queue-Jobs (z.B. Backup) müssen den Tenant-Kontext explizit selbst setzen:
   ```php
   app()->instance('currentTenant', $tenant);
   ```

4. **`tenant_id` ist nullable** (historisch bedingt durch die Nachrüstung). Zeilen mit `tenant_id = NULL` erscheinen in keinem Tenant-Scope, existieren aber ggf. noch als Altdaten.

5. **Admin-Abfragen über alle Tenants:** `Model::withoutGlobalScope('tenant')` verwenden (bewusst und sparsam). Die Trait-Methode `withoutTenantScope(Closure)` ist unglücklich implementiert (führt `get()->each()` aus) – besser direkt `withoutGlobalScope` nutzen.

6. **Kein Index auf `tenant_id`** bei mehreren Tabellen: Die Nachrüst-Migration hat nur FKs erstellt; PostgreSQL indiziert FK-Spalten nicht automatisch. Composite-Uniques decken `accounts`, `tax_codes`, `invoices`, `belege` ab – `journal_entries`, `contacts`, `bank_accounts` u.a. haben keinen `tenant_id`-Index (Performance, siehe 08).

## Tests

`tests/Feature/TenantIsolationTest.php` prüft die Grundisolation. **Jedes neue Feature mit Tenant-Daten sollte einen Isolationstest bekommen** (User A darf Daten von Tenant B weder lesen noch referenzieren).
