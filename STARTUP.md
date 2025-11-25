# 🚀 AT-Book Projekt Starten - Anleitung

## Problem: "Vite manifest not found"

Dieser Fehler tritt auf, weil der Vite Development Server noch nicht läuft.

## ✅ Lösung: Projekt in 2 Terminals starten

### Terminal 1: Vite Development Server (Frontend)

```bash
# Im WSL Terminal
cd /home/ahmed/LaravelProjects/at-book

# Vite starten
npm run dev
```

**Erwartete Ausgabe:**
```
VITE v7.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Terminal 2: Laravel Sail (Backend)

```bash
# Im WSL Terminal (neues Terminal)
cd /home/ahmed/LaravelProjects/at-book

# Laravel Sail starten (falls noch nicht läuft)
./vendor/bin/sail up -d

# Prüfen ob Sail läuft
./vendor/bin/sail ps
```

## 🌐 Projekt öffnen

Nach dem Start beider Server:

1. **Öffnen Sie Ihren Browser**
2. **Gehen Sie zu:** `http://localhost` (oder der Port den Sail verwendet, z.B. `http://localhost:80`)

## 🔧 Troubleshooting

### Problem: npm install schlägt fehl

```bash
# Cache leeren
npm cache clean --force

# Neu installieren
npm install
```

### Problem: Port bereits belegt

```bash
# Vite auf anderem Port starten
npm run dev -- --port 5174
```

### Problem: Laravel Sail läuft nicht

```bash
# Sail starten
./vendor/bin/sail up -d

# Logs anschauen
./vendor/bin/sail logs
```

### Problem: Datenbank nicht migriert

```bash
# Migrationen ausführen
./vendor/bin/sail artisan migrate:fresh

# Accounts seeden
./vendor/bin/sail artisan db:seed --class=AccountSeeder
```

## 📋 Komplette Startup-Sequenz

```bash
# 1. Zum Projektverzeichnis
cd /home/ahmed/LaravelProjects/at-book

# 2. NPM Dependencies installieren (einmalig)
npm install

# 3. Laravel Sail starten
./vendor/bin/sail up -d

# 4. Datenbank migrieren (einmalig)
./vendor/bin/sail artisan migrate:fresh
./vendor/bin/sail artisan db:seed --class=AccountSeeder

# 5. Vite Development Server starten
npm run dev
```

## 🎯 Was Sie sehen sollten

Nach erfolgreichem Start sehen Sie:

1. **Im Terminal (Vite):**
   ```
   ➜  Local:   http://localhost:5173/
   ➜  ready in 234 ms
   ```

2. **Im Browser (http://localhost):**
   - AT-Book Header
   - "GoBD-Compliant Accounting System" Untertitel
   - Booking Mask Formular

## 🔄 Entwicklungs-Workflow

### Jeden Tag starten:

```bash
# Terminal 1: Vite
npm run dev

# Terminal 2: Sail (falls gestoppt)
./vendor/bin/sail up -d
```

### Am Ende des Tages stoppen:

```bash
# Vite: Ctrl+C im Terminal

# Sail stoppen
./vendor/bin/sail down
```

## 🆘 Häufige Fehler

### "Cannot find module 'react'"
```bash
npm install
```

### "SQLSTATE[HY000] [2002] Connection refused"
```bash
./vendor/bin/sail up -d
```

### "Class 'AccountSeeder' not found"
```bash
./vendor/bin/sail artisan db:seed --class=AccountSeeder
```

## 📞 Nächste Schritte

Nach erfolgreichem Start können Sie:

1. ✅ Buchungen erstellen über die UI
2. ✅ API testen mit Postman: `http://localhost/api/accounts`
3. ✅ Datenbank prüfen: `./vendor/bin/sail artisan tinker`

---

**Viel Erfolg! 🚀**
