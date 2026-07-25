# 📚 Account Seeder - Komplette Anleitung

## 📍 Wo ist der Account Seeder?

**Datei:** `database/seeders/AccountSeeder.php`

## ✅ Was enthält der Seeder?

Der Seeder erstellt automatisch diese Konten:

### Asset Konten (Aktiva)
- `1000` - Kasse
- `1200` - Bank  
- `1400` - Forderungen a.LL.
- `1576` - Vorsteuer 19%
- `1571` - Vorsteuer 7%

### Liability Konten (Passiva)
- `1600` - Verbindlichkeiten a.LL.
- `1776` - Umsatzsteuer 19%
- `1771` - Umsatzsteuer 7%

### Revenue Konten (Erlöse)
- `8400` - Erlöse 19% USt
- `8300` - Erlöse 7% USt
- `8100` - Steuerfreie Umsätze

### Expense Konten (Aufwand)
- `3400` - Wareneingang 19%
- `4930` - Bürobedarf
- `4980` - Betriebsbedarf

---

## 🚀 Wie führe ich den Seeder aus?

### Methode 1: Einfaches Skript (EMPFOHLEN)

```bash
bash setup-accounts.sh
```

### Methode 2: Manuell - Nur Seeder

Wenn Migration bereits gelaufen ist:

```bash
./vendor/bin/sail artisan db:seed --class=AccountSeeder
```

### Methode 3: Manuell - Migration + Seeder

Wenn Migration noch nicht gelaufen ist:

```bash
# 1. Migration ausführen
./vendor/bin/sail artisan migrate

# 2. Seeder ausführen
./vendor/bin/sail artisan db:seed --class=AccountSeeder
```

### Methode 4: Alles neu (Vorsicht! Löscht Daten!)

Nur verwenden, wenn du die Datenbank komplett neu aufbauen willst:

```bash
./vendor/bin/sail artisan migrate:fresh --seed
```

⚠️ **WARNUNG:** `migrate:fresh` löscht ALLE Daten!

---

## 📝 Wann muss ich den Seeder ausführen?

### Führe den Seeder aus, wenn:

1. ✅ Du die Datenbank neu aufgesetzt hast
2. ✅ Die Konten fehlen (z.B. nach `migrate:fresh`)
3. ✅ Du neue Konten zum Seeder hinzugefügt hast

### Du musst NICHT erneut seeden, wenn:

- ❌ Die Konten bereits in der Datenbank existieren
- ❌ Du nur Code-Änderungen gemacht hast (z.B. `BookingCreate.tsx`)
- ❌ Du nur Frontend-Änderungen hast

**Hinweis:** Der Seeder verwendet `updateOrCreate()`, du kannst ihn also **mehrfach** ausführen ohne Duplikate zu erstellen.

---

## 🔍 Wie prüfe ich ob die Konten existieren?

### Option 1: In der Datenbank

```bash
./vendor/bin/sail artisan tinker
```

Dann:
```php
\App\Modules\Accounting\Models\Account::count()
// Sollte mindestens 12 zurückgeben

\App\Modules\Accounting\Models\Account::where('code', '1776')->first()
// Sollte "Umsatzsteuer 19%" zeigen
```

### Option 2: Im Browser

1. Gehe zu "Konten" oder "Accounts" Seite
2. Suche nach "1776 - Umsatzsteuer 19%"
3. Wenn vorhanden → ✅ Seeder war erfolgreich

### Option 3: SQL Query

```bash
./vendor/bin/sail artisan db
```

Dann:
```sql
SELECT code, name FROM accounts ORDER BY code;
```

---

## ❓ Häufige Fragen

### **F: Muss ich den Seeder nach jedem Code-Update ausführen?**
**A:** Nein! Nur wenn:
- Du die Datenbank zurückgesetzt hast (`migrate:fresh`)
- Neue Konten zum Seeder hinzugefügt wurden
- Die Konten fehlen

### **F: Kann ich den Seeder mehrfach ausführen?**
**A:** Ja! Der Seeder verwendet `updateOrCreate()`, es werden keine Duplikate erstellt.

### **F: Was passiert wenn ich Parameter in einem Konto ändere?**
**A:** Führe den Seeder erneut aus, er aktualisiert bestehende Konten.

### **F: Wie füge ich ein neues Konto hinzu?**
**A:** 
1. Öffne `database/seeders/AccountSeeder.php`
2. Füge das Konto im `$accounts` Array hinzu:
```php
['code' => '1800', 'name' => 'Neues Konto', 'type' => 'asset', 'tax_key_code' => null],
```
3. Führe Seeder aus:
```bash
./vendor/bin/sail artisan db:seed --class=AccountSeeder
```

---

## ✅ Zusammenfassung

1. **Seeder Location:** `database/seeders/AccountSeeder.php`
2. **Befehl:** `./vendor/bin/sail artisan db:seed --class=AccountSeeder`
3. **Oder einfach:** `bash setup-accounts.sh`

**Fertig! Alle Konten sind jetzt in deiner Datenbank! 🎉**
