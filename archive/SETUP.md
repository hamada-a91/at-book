# AT-Book - SKR03 Accounting System Setup

## 🚀 Quick Start (Fresh Installation)

Nach einem `migrate:fresh` einfach den Seeder ausführen:

```bash
# Alles in einem Command
wsl vendor/bin/sail artisan migrate:fresh --seed
```

Das erstellt automatisch:
- ✅ Demo Firma (Demo Firma GmbH, Berlin)
- ✅ Kompletter SKR03 Kontenplan (~50+ Konten)
- ✅ Tax Codes (UST19, UST7, VST19, VST7, RC, IG, EX)
- ✅ Onboarding als abgeschlossen markiert
- ✅ Geschäftsmodelle: Dienstleistungen + Handel
- ✅ Rechtsform: GmbH

**Danach können Sie sofort loslegen:**
- Dashboard ist zugänglich
- Alle Module funktionieren
- Keine 403 Errors mehr

---

## 📋 Was der Seeder macht

Der `CompanySettingSeeder` führt folgende Schritte aus:

1. **Erstellt Company Settings** mit:
   - Firma: "Demo Firma GmbH"
   - Standort: Berlin, Deutschland
   - Steuerart: Umsatzsteuerpflichtig
   - E-Mail & Telefon

2. **Generiert SKR03 Kontenplan**:
   - Basis-Konten (Klasse 0-9)
   - Geschäftsmodell-spezifische Konten
   - Rechtsform-spezifische Konten (GmbH)
   - Collective Accounts (1400, 1600)
   - Tax Accounts (1576, 1776, etc.)

3. **Erstellt Tax Codes**:
   - UST19 (19% Umsatzsteuer)
   - UST7 (7% Umsatzsteuer)
   - VST19 (19% Vorsteuer)
   - VST7 (7% Vorsteuer)
   - RC (Reverse Charge)
   - IG (Innergemeinschaftlich)
   - EX (Export)

4. **Markiert Onboarding als abgeschlossen**
   - Kein Onboarding-Wizard erforderlich
   - Alle geschützten Routen zugänglich

---

## 🔄 Onboarding manuell durchführen

Falls Sie das Onboarding selbst durchlaufen möchten:

```bash
# 1. Nur Migrationen ohne Seeder
wsl vendor/bin/sail artisan migrate:fresh

# 2. Browser öffnen und zu /onboarding navigieren
# 3. Wizard durchlaufen
```

---

## 🛠️ Entwicklung

### Onboarding zurücksetzen
```bash
wsl vendor/bin/sail artisan onboarding:reset
```

### Status prüfen
```bash
wsl vendor/bin/sail artisan tinker
```
```php
$s = App\Models\CompanySetting::first();
echo "Completed: " . ($s->onboarding_completed ? 'YES' : 'NO');
echo "\nAccounts: " . App\Modules\Accounting\Models\Account::count();
```

### Kontenplan erweitern
Im Dashboard → Settings → Account Plan Management → "Geschäftsmodell hinzufügen"

---

## 📊 Features

- ✅ **SKR03-konform**: Standard-Kontenrahmen für Deutschland
- ✅ **Flexible Account Plans**: Per Geschäftsmodell anpassbar
- ✅ **Tax Automation**: Automatische Steuerschlüssel
- ✅ **Aggregation**: Debitoren/Kreditoren in Bilanz aggregiert
- ✅ **Modern UI**: Colorful Onboarding Wizard
- ✅ **Dark Mode**: Vollständige Dark Mode Unterstützung

---

## 🎨 Demo Daten

**Firma:**
- Name: Demo Firma GmbH
- Adresse: Musterstraße 123, 10115 Berlin
- E-Mail: info@demo-firma.de
- Telefon: +49 30 12345678
- Steuernummer: DE123456789

**Account Plan:**
- ~50-60 Konten (je nach Geschäftsmodell)
- Business Models: Dienstleistungen + Handel
- Legal Form: GmbH
- Tax Codes: Alle deutschen Standard-Codes

---

## 🐛 Troubleshooting

**403 Forbidden Errors:**
```bash
# Lösung: Onboarding abschließen
wsl vendor/bin/sail artisan migrate:fresh --seed
```

**Kontenplan leer:**
```bash
# Lösung: Seeder erneut ausführen
wsl vendor/bin/sail artisan db:seed --class=CompanySettingSeeder
```

**Onboarding Loop:**
```bash
# Lösung: Manually complete
wsl vendor/bin/sail artisan tinker
```
```php
App\Models\CompanySetting::first()->update(['onboarding_completed' => true]);
```

---

Made with ❤️ by AT-Book Team
