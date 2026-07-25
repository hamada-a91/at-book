# 🎉 Neue Features: Automatisierte Buchhaltung

## Übersicht

Wir haben zwei wichtige Automatisierungsfunktionen implementiert:

1. **Automatische Kontenerstellung** - Wenn Sie einen Kunden oder Lieferanten erstellen, wird automatisch ein Debitor-/Kreditorenkonto angelegt
2. **Schnelleingabe für Buchungen** - Vereinfachte Buchungserstellung mit automatischer Berechnung von Netto, Brutto und Umsatzsteuer

---

## ✨ Was ist neu?

### 1. Automatische Kontenerstellung

Beim Anlegen eines neuen Kontakts (Kunde oder Lieferant) wird automatisch ein zugehöriges Konto erstellt:

- **Kunden (Debitoren)**: Konten ab 10001
- **Lieferanten (Kreditoren)**: Konten ab 70001
- Der Kontoname entspricht dem Kontaktnamen
- Das Konto wird automatisch dem Kontakt zugewiesen

### 2. Schnelleingabe bei Buchungen

Die neue "Schnelleingabe"-Funktion in der Buchungsmaske ermöglicht:

**Eingabe:**
- Kontakt auswählen (Kunde/Lieferant)
- Gegenkonto auswählen (Erlös-/Aufwandskonto) - **mit Suchfunktion!**
- MwSt-Satz wählen (19%, 7% oder 0%)
- Bruttobetrag eingeben

**Automatische Generierung:**
- Berechnung von Nettobetrag und Steuerbetrag
- Erstellung von 2-3 Buchungszeilen:
  - Bei Kundenverkauf: Soll Debitor, Haben Erlös, Haben Umsatzsteuer
  - Bei Lieferanteneinkauf: Haben Kreditor, Soll Aufwand, Soll Vorsteuer
- Automatisches Ausfüllen der Beschreibung

**Beispiel Kundenverkauf (119 EUR brutto, 19% MwSt):**
```
Soll:  10001 - Kunde Max Mustermann    119,00 EUR
Haben: 8400  - Erlöse 19% USt          100,00 EUR
Haben: 1776  - Umsatzsteuer 19%         19,00 EUR
```

### 3. Kontosuchfunktion

Die neue `AccountSelector`-Komponente bietet:
- Suche nach Kontonummer oder Kontoname
- Filterung nach Kontotyp (Erlös, Aufwand, etc.)
- Übersichtliche Darstellung aller Konten

---

## 🚀 Installation & Setup

### Schritt 1: Migration ausführen

```bash
bash setup-accounting-automation.sh
```

Oder manuell:
```bash
cd /home/ahmed/LaravelProjects/at-book
./vendor/bin/sail artisan migrate
./vendor/bin/sail artisan db:seed --class=AccountSeeder
```

### Schritt 2: Testen

Folgen Sie der Anleitung in `TESTING_GUIDE.md`

---

## 📁 Neue/Geänderte Dateien

### Backend
- ✅ Migration: `database/migrations/2025_11_27_000002_add_account_id_to_contacts_table.php`
- ✅ Model: `app/Modules/Contacts/Models/Contact.php`
- ✅ Controller: `app/Http/Controllers/Api/ContactController.php`
- ✅ Seeder: `database/seeders/AccountSeeder.php` (7% MwSt-Konten hinzugefügt)

### Frontend
- ✅ Neue Komponente: `resources/js/components/AccountSelector.tsx`
- ✅ Erweiterte Seite: `resources/js/pages/BookingCreate.tsx`

### Dokumentation
- ✅ `ARCHITECTURE.md` - Aktualisierte Architektur-Dokumentation
- ✅ `IMPLEMENTATION_SUMMARY.md` - Implementierungszusammenfassung
- ✅ `TESTING_GUIDE.md` - Testanleitung
- ✅ `NEUE_FEATURES.md` - Diese Datei

---

## 🎯 Verwendung

### Kontakt mit automatischem Konto erstellen

1. Gehe zu **Kontakte**
2. Klicke auf **"Neuen Kontakt erstellen"**
3. Fülle das Formular aus (Name, Typ, etc.)
4. Klicke auf **"Speichern"**
5. ✨ Ein Konto wird automatisch erstellt!

### Schnelleingabe für Buchung verwenden

1. Gehe zu **Neue Buchung**
2. Scrolle zum **"Schnelleingabe"**-Bereich (blau hervorgehoben)
3. Wähle:
   - **Kontakt** (z.B. Kunde "Max Mustermann")
   - **Gegenkonto** (z.B. "8400 - Erlöse 19%") - Nutze die Suchfunktion!
   - **MwSt-Satz** (19%, 7% oder 0%)
   - **Bruttobetrag** (z.B. 119,00 EUR)
4. Klicke auf **"Ausfüllen"** ⚡
5. ✨ Die Buchungszeilen werden automatisch generiert!
6. Überprüfe und klicke auf **"Buchung speichern"**

---

## 📝 Hinweise

### MwSt-Konten

Die folgenden Konten müssen in der Datenbank vorhanden sein (werden durch Seeder angelegt):
- **1776** - Umsatzsteuer 19%
- **1771** - Umsatzsteuer 7%
- **1576** - Vorsteuer 19%
- **1571** - Vorsteuer 7%

### Kontonummernkreise

- **10000-19999**: Debitorenkonten (Kunden)
- **70000-79999**: Kreditorenkonten (Lieferanten)

Diese folgen der SKR03-Konvention.

---

## 🐛 Bekannte Einschränkungen

1. **Bestehende Kontakte**: Kontakte, die vor diesem Update erstellt wurden, haben kein verknüpftes Konto. Diese müssen neu erstellt oder manuell verknüpft werden.
2. **MwSt-Konto-IDs**: Die IDs der MwSt-Konten sind im Code fest einprogrammiert. Falls die Datenbank andere IDs verwendet, muss `BookingCreate.tsx` angepasst werden.

---

## ❓ Support & Fragen

Bei Fragen oder Problemen:
1. Siehe `TESTING_GUIDE.md` für Troubleshooting
2. Siehe `IMPLEMENTATION_SUMMARY.md` für technische Details
3. Siehe `ARCHITECTURE.md` für Systemarchitektur

---

**Viel Erfolg mit den neuen Funktionen! 🎊**
