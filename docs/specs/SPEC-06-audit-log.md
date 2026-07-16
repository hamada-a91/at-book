# SPEC-06 – Audit-Log aktivieren

**Phase:** 2 · **Aufwand:** ~1–2 Tage · **Abhängigkeiten:** SPEC-02 · **Behebt:** 08/Punkt 9 (GoBD-Nachvollziehbarkeit)

## Ziel
Jede buchhaltungsrelevante Aktion wird unveränderlich protokolliert. Tabelle `audit_logs` + Model existieren bereits (`Modules/Accounting/Models/AuditLog`), werden aber nicht befüllt.

## Umsetzung

### 6.1 Schema prüfen/ergänzen
`audit_logs` soll enthalten: `tenant_id` (FK + Index), `user_id`, `auditable_type`, `auditable_id`, `event` (created/updated/deleted/locked/reversed/booked/sent/paid/imported), `old_values` (jsonb), `new_values` (jsonb), `ip_address`, `created_at`. Fehlende Spalten per Migration nachrüsten. **Keine `updated_at`, keine Updates, keine Deletes** – append-only.

### 6.2 Observer-basierte Protokollierung
`app/Modules/Accounting/Observers/AuditObserver.php`, registriert für:

| Model | Events |
|---|---|
| `JournalEntry` (+ Lines über Parent) | created, updated (nur Drafts), locked, reversed, deleted |
| `Invoice` | created, updated, booked, sent, paid, cancelled |
| `Beleg` | created, updated, booked, paid, file-upload |
| `Account`, `TaxCode`, `BankAccount` | created, updated, deleted |
| `User` | created, role-changed, blocked/unblocked |

- Fachliche Events (locked, booked, reversed …) werden **explizit aus den Services** gefeuert (`AuditLog::record($model, 'locked')`), Standard-CRUD über Model-Observer.
- `old_values`/`new_values`: nur geänderte Attribute (`$model->getChanges()`/`getOriginal()`), sensible Felder (password) ausschließen.
- Tenant-Kontext: aus `tenant()`; in Jobs aus dem Model (`$model->tenant_id`) — nie null schreiben, sonst Exception.

### 6.3 Zugriff
- Endpoint `GET /api/audit-logs?auditable_type=&auditable_id=&from=&to=` (nur Rollen `owner`/`buchhalter`), paginiert.
- UI später (Detail-Ansichten „Verlauf“-Tab); nicht Teil dieser Spec.

## Akzeptanzkriterien
- [ ] Buchung anlegen → `created`-Eintrag mit User, Tenant, Werten
- [ ] `lock` / `reverse` / Invoice-`book` → je eigener Event-Eintrag
- [ ] Audit-Einträge sind nicht änderbar/löschbar (Model wirft bei `update`/`delete`)
- [ ] Draft-Änderung protokolliert Diff (`old_values` → `new_values`)
- [ ] Feature-Test deckt die 4 Punkte ab; kein spürbarer Performance-Einbruch bei Listen (Observer feuert nur bei Schreiboperationen)

## Backup-Impact ⚠️
- `audit_logs` ist tenant-scoped → Entscheidung: **mit exportieren** (GoBD-Nachvollziehbarkeit bleibt nach Restore erhalten – empfohlen) → neuer `AuditLogTransformer` + Registry-Eintrag + Roundtrip-Test-Erweiterung.
- Import erzeugt zusätzlich einen eigenen Audit-Eintrag `imported` pro Restore-Vorgang (bereits ähnlich in `backup_audit_logs` vorhanden – nicht verwechseln: `backup_audit_logs` bleibt unangetastet!).
- Alte Backups ohne `audit_logs`-Sektion müssen importierbar bleiben (Sektion optional).
