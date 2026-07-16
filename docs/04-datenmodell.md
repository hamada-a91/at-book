# 04 – Datenmodell & Buchhaltungslogik

## Grundprinzipien

1. **Beträge in Cents** (Integer/BigInteger) – nie Floats. `journal_entry_lines.amount` ist `bigInteger`, `invoices.subtotal/tax_total/total` sind `integer` (⚠️ Inkonsistenz, siehe 08).
2. **Doppelte Buchführung:** Jede Buchung besteht aus einem Header (`journal_entries`) und ≥ 2 Zeilen (`journal_entry_lines`) mit `type = debit|credit`. Summe Soll = Summe Haben (erzwungen im `BookingService`).
3. **GoBD-Prinzip:** Gebuchte/festgeschriebene Einträge werden nie geändert oder gelöscht – nur storniert. Soft Deletes zusätzlich als Sicherheitsnetz.

## Kern-Tabellen (Buchhaltung)

### `accounts` – Kontenplan (SKR03)
| Spalte | Bedeutung |
|---|---|
| `code` | Kontonummer, z.B. `8400` (unique **pro Tenant**) |
| `name` | z.B. „Erlöse 19% USt“ |
| `type` | `asset` / `liability` / `equity` / `revenue` / `expense` |
| `category` | Gruppierung für Reports |
| `tax_key_code` | Default-Steuerschlüssel, z.B. `UST_19` |
| `is_system` | Systemkonten sind nicht löschbar |

Generierung beim Onboarding durch `Skr03AccountPlanGenerator` (Basis + Geschäftsmodell + Rechtsform).

### `journal_entries` + `journal_entry_lines` – Das Journal (Herzstück)
```
journal_entries:      id, tenant_id, public_id, batch_id (UUID), booking_date,
                      description, status (draft|posted|cancelled), locked_at,
                      user_id, contact_id, beleg_id, softDeletes
journal_entry_lines:  id, journal_entry_id, account_id, type (debit|credit),
                      amount (Cents), tax_key, tax_amount (Cents)
```

**Statusfluss:**
```
draft ──lock()──► posted (locked_at gesetzt, unveränderlich)
                    │
                    └──reverse()──► Original: cancelled
                                    + neue Storno-Buchung (posted, Seiten getauscht)
```
- Drafts dürfen gelöscht/geändert werden.
- `posted` nur per Storno (Generalumkehr) korrigierbar.
- ⚠️ Eine **lückenlose Journalnummer** bei Festschreibung ist im Code als TODO vermerkt, aber nicht implementiert.

### `tax_codes` – Steuerschlüssel
Pro Tenant, z.B. `UST_19`, `VST_19`, mit Prozentsatz und zugeordnetem Automatikkonto.

### `audit_logs`
Tabelle + Model existieren, das Schreiben von Audit-Einträgen ist aber **nicht aktiviert** (im `BookingService` auskommentiert) – siehe 08.

## Belegwesen

### `belege` – Ein-/Ausgangsbelege
| Spalte | Bedeutung |
|---|---|
| `document_number` | unique pro Tenant |
| `document_type` | `ausgang` / `eingang` / `offen` / `sonstige` |
| `amount`, `tax_amount` | Cents (brutto/Steueranteil) |
| `contact_id`, `journal_entry_id` | Verknüpfungen |
| `file_path`, `file_name` | hochgeladene Belegdatei (Storage) |
| `status` | `draft` / `booked` / `paid` / `cancelled` |
| `due_date`, Zahlungsfelder | Fälligkeit/Zahlungsverfolgung |

Dazu `beleg_lines` (Positionen, optional mit `product_id` und `category_account_id`). Der Beleg-Buchungsworkflow ist in `.agent/implementation-docs/beleg-workflow-buchungen.md` beschrieben. **Dies ist der natürliche Andockpunkt für das geplante OCR-Feature** (Upload → OCR → Vorbefüllung → Buchungsvorschlag).

## Verkaufsprozess (Belegkette)

```
Quote (Angebot)  ──accept/create-order──►  Order (Auftrag)
                                             │
                              ┌──────────────┴───────────────┐
                    create-delivery-note              create-invoice
                              ▼                              ▼
                    DeliveryNote (Lieferschein) ──► Invoice (Rechnung)
                                                         │ book()
                                                         ▼
                                                   JournalEntry (posted)
                                                   + Lagerabgang (InventoryService)
```

Jedes Dokument hat eigene Line-Tabellen (`quote_lines`, `order_lines`, `delivery_note_lines`, `invoice_lines`), jeweils optional mit `product_id`.

### `invoices`
- Nummernkreis pro Tenant und Jahr: `RE-2026-0001` (Generierung: letzte Nummer + 1 → ⚠️ Race-Condition-anfällig, nicht lückenlos garantiert, siehe 08).
- Status: `draft` → `booked` → `sent` → `paid` (bzw. `cancelled`).
- `book()` erzeugt die automatische Buchung: **Soll Debitor (brutto) an Erlöskonten (netto, gruppiert je Konto+Steuersatz) + USt-Konto** (Code `1776` hartcodiert).
- `recordPayment()` bucht **Kasse/Bank an Debitor**.

## Kontakte & Nebenbücher

`contacts` (Modul Contacts): Kunden und Lieferanten. Beim Anlegen werden automatisch **persönliche Debitoren-/Kreditorenkonten** erzeugt und verknüpft (`customer_account_id` / `supplier_account_id` → `accounts`). Ein Kontakt kann beides gleichzeitig sein („dual accounts“).

## Warenwirtschaft

```
products (Bestandsführung optional, track_inventory)
product_categories
inventory_transactions (Bewegungen: purchase/sale/adjustment, mit Referenz-Dokument)
```
`InventoryService` kapselt Zu-/Abgänge. Beim Buchen einer Rechnung mit Produktzeilen wird der Bestand automatisch reduziert.

## Sonstige Tabellen

| Tabelle | Zweck |
|---|---|
| `company_settings` | Firmenstammdaten pro Tenant, Onboarding-Status, Modul-Flags (z.B. `module_inventory_enabled`), Rechnungs-Fußzeilen |
| `bank_accounts` | Bankkonten, verknüpft mit Sachkonto (`account_id`), Default-Konto wählbar |
| `settings` | Key-Value-Einstellungen |
| `bug_reports` | In-App-Fehlermeldungen der User (Admin bearbeitet Status/Priorität) |
| `backup_jobs`, `backup_audit_logs` | Backup-Modul (siehe [backup-module.md](backup-module.md)) |
| `serial_numbers` | Aktivierungs-Seriennummern (Feature-Flag `ENABLE_SERIAL_NUMBER_ACTIVATION`) |
| `users` | Mit `tenant_id` (nullable für Plattform-Admins), `blocked_at`, Spatie-Rollen |
| `documents` | Dokumenten-Metadaten (Modul Documents) |

## GoBD-Konformität – Ist-Zustand

| Anforderung | Status |
|---|---|
| Unveränderlichkeit nach Festschreibung | ✅ `locked_at` + Storno-Zwang im `BookingService` |
| Stornierung statt Löschung | ✅ Generalumkehr implementiert |
| Nachvollziehbarkeit (Audit Trail) | ⚠️ `audit_logs` vorhanden, aber nicht befüllt |
| Lückenlose Journalnummerierung | ❌ Nicht implementiert (TODO im Code) |
| Automatische Festschreibung von Rechnungsbuchungen | ⚠️ `book()` setzt `posted`, aber kein `locked_at` |
| Zeitnahe/lückenlose Belegnummern | ⚠️ Nummernkreis ohne Sperre (Race Condition möglich) |
| Verfahrensdokumentation | ❌ Fehlt |

→ Konkrete Maßnahmen in [08-kritische-punkte.md](08-kritische-punkte.md).

## Migrations-Hinweis

Der `database/migrations/`-Ordner ist historisch gewachsen und enthält **Duplikate** (z.B. `add_beleg_id_to_journal_entries` 2×, `create_beleg_lines` 3×, `add_payment_fields_to_belege` 2×, `add_product_id_to_invoice_lines` 2×) – die Duplikate sind intern idempotent abgesichert (hasColumn/hasTable-Checks), aber verwirrend. Vor größeren Schemaänderungen 08 lesen; für neue Tabellen gilt: `tenant_id` + Index + zusammengesetzte Uniques von Anfang an.
