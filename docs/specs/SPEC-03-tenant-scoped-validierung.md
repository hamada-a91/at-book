# SPEC-03 – Tenant-scoped Validierung

**Phase:** 1 · **Aufwand:** ~1–2 Tage · **Abhängigkeiten:** SPEC-02 (Tests) · **Behebt:** 08/Punkt 4 (P0!)

## Ziel
Kein API-Request darf IDs fremder Tenants referenzieren. Aktuell erlauben nackte `exists:tabelle,id`-Regeln Cross-Tenant-Referenzen (z.B. Buchungszeile auf Konto eines fremden Mandanten).

## Umsetzung

### 3.1 Zentrale Rule `app/Rules/TenantExists.php`
```php
class TenantExists implements ValidationRule
{
    public function __construct(private string $table, private string $column = 'id') {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $tenant = tenant();
        if (!$tenant) { $fail('Kein Mandanten-Kontext.'); return; }

        $exists = DB::table($this->table)
            ->where($this->column, $value)
            ->where('tenant_id', $tenant->id)
            ->exists();

        if (!$exists) { $fail("Der ausgewählte Wert für :attribute ist ungültig."); }
    }
}
```
Fehlermeldung bewusst identisch zu „nicht gefunden“ – nicht verraten, dass die ID bei einem anderen Tenant existiert.

### 3.2 Alle Vorkommen ersetzen
Suche: `grep -rn "exists:" app/Http/Controllers`. Zu ersetzende Muster (Stand heute):

| Controller | Felder |
|---|---|
| `JournalEntryController` | `contact_id`, `beleg_id`, `lines.*.account_id` |
| `InvoiceController` | `contact_id`, `order_id`, `lines.*.product_id`, `lines.*.account_id` |
| `BelegController` | `contact_id`, `journal_entry_id`, `lines.*.product_id`, `category_account_id` |
| `QuoteController` / `OrderController` / `DeliveryNoteController` | `contact_id`, `order_id`, `quote_id`, `lines.*.product_id` |
| `ContactController` | Konten-Referenzen |
| `BankAccountController` | `account_id` |
| `ProductController` / `ProductCategoryController` | `category_id` u.ä. |
| `UserController` | keine Tabellen-`exists`, aber prüfen |

Ausnahmen (bewusst NICHT scopen): Lookups auf nicht-tenant-Tabellen (`roles`, `users` nur innerhalb Owner-Logik prüfen).

### 3.3 Route-Model-Binding absichern
Implizites Binding (`Invoice $invoice` etc.) ist durch den Global Scope bereits sicher (fremde ID → 404). Kontrollieren, dass **kein** Controller `withoutGlobalScope`/`findOrFail` auf rohe Request-IDs ohne Scope anwendet (`BookingService::lockBooking/reverseBooking` laufen im HTTP-Kontext → Scope aktiv; OK, aber Kommentar ergänzen).

## Akzeptanzkriterien
- [ ] Neue Rule `TenantExists` mit Unit-Test
- [ ] `grep -rn "'exists:" app/Http` liefert keine ungescopten Treffer auf Tenant-Tabellen mehr
- [ ] Feature-Test: User von Tenant B sendet `account_id`/`contact_id`/`product_id` von Tenant A → **422**, kein Datensatz angelegt (für Bookings, Invoices, Belege)
- [ ] Bestehende Happy-Path-Tests weiterhin grün

## Backup-Impact
Keiner (keine Schema-Änderung). Aber: Der Import-Service nutzt eigene Mapping-Logik (`ImportIdMapping`), **nicht** die HTTP-Validierung – nichts an `Services/Backup/` anfassen. ✅
