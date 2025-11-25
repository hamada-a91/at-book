---
description: Start the AT-Book development environment
---

# Workflow: AT-Book Development Server starten

## Voraussetzungen
- Laravel Sail muss installiert sein
- npm Dependencies müssen installiert sein

## Schritte

// turbo-all

1. **Zum Projektverzeichnis navigieren**
```bash
cd /home/ahmed/LaravelProjects/at-book
```

2. **Laravel Sail starten (falls nicht läuft)**
```bash
./vendor/bin/sail up -d
```

3. **Vite Development Server starten**
```bash
npm run dev
```

4. **Browser öffnen**
Öffnen Sie: `http://localhost`

## Erwartetes Ergebnis

- Vite läuft auf Port 5173
- Laravel Sail läuft auf Port 80
- Die AT-Book Anwendung ist unter `http://localhost` erreichbar

## Troubleshooting

Falls "Vite manifest not found" Fehler:
- Stellen Sie sicher, dass `npm run dev` läuft
- Prüfen Sie ob Port 5173 frei ist

Falls "Connection refused":
- Starten Sie Sail: `./vendor/bin/sail up -d`
