# Production Deployment Guide

Hier ist die Schritt-für-Schritt-Anleitung, um deine App auf dem Production-Server zu installieren.

## 1. Voraussetzungen auf dem Server
Stelle sicher, dass **Docker** und **Docker Compose** auf dem Server installiert sind.

## 2. Code auf den Server bringen
Klone dein Repository auf den Server (z.B. nach `/var/www/at-book`):
```bash
cd /var/www
git clone https://github.com/dein-user/at-book.git
cd at-book
```

## 3. Environment Variablen (.env)
Erstelle eine `.env` Datei im Projektverzeichnis.
Wichtig: Unsere `compose.production.yaml` erwartet einige Variablen für die Datenbank, die nicht fest eincodiert sind.

Erstelle die Datei:
```bash
nano .env
```

Füge folgenden Inhalt ein (ersetze die Passwörter!):
```ini
# Server Configuration
APP_PORT=8081
VITE_PORT=5173

# Database Secrets (werden von compose.production.yaml benötigt)
DB_DATABASE=atbook_prod
DB_USERNAME=atbook_user
DB_PASSWORD=DeinSicheresDatenbankPasswort
FORWARD_DB_PORT=5432

# User IDs (damit keine Permission Probleme entstehen)
WWWGROUP=1000
WWWUSER=1000
```

## 4. Berechtigungen setzen
Mache das Deployment-Script ausführbar:
```bash
chmod +x production-deploy.sh
```

## 5. Deployment starten
Starte die Installation. Das Script baut die Container, migriert die DB und setzt alles auf:
```bash
./production-deploy.sh
```

## 6. Apache Reverse Proxy einrichten
Da du Apache auf dem Server nutzt, musst du einen VirtualHost erstellen, der die Anfragen an deinen Docker-Container (Port 8081) weiterleitet.

Erstelle eine neue Conf-Datei (z.B. `/etc/apache2/sites-available/at-book.conf`):

```apache
<VirtualHost *:80>
    ServerName at-book.vorpoint.de
    
    # Weiterleitung an HTTPS erzwingen (optional aber empfohlen)
    RewriteEngine on
    RewriteCond %{SERVER_NAME} =at-book.vorpoint.de
    RewriteRule ^ https://%{SERVER_NAME}%{REQUEST_URI} [END,NE,R=permanent]
</VirtualHost>

<VirtualHost *:443>
    ServerName at-book.vorpoint.de

    # SSL Konfiguration (Pfade anpassen!)
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/at-book.vorpoint.de/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/at-book.vorpoint.de/privkey.pem

    # Reverse Proxy Einstellungen
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:8081/
    ProxyPassReverse / http://127.0.0.1:8081/

    # Websocket Support (für Vite HMR falls nötig, sonst optional)
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://127.0.0.1:8081/$1 [P,L]
    
    ErrorLog ${APACHE_LOG_DIR}/at-book-error.log
    CustomLog ${APACHE_LOG_DIR}/at-book-access.log combined
</VirtualHost>
```

Aktiviere die Seite und Proxy-Module:
```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod rewrite
sudo a2enmod ssl
sudo a2ensite at-book.conf
sudo systemctl restart apache2
```

## 7. Updates in Zukunft
Wenn du neuen Code pushst, musst du auf dem Server nur folgendes tun:
1. `git pull`
2. `./production-deploy.sh`

Das Script kümmert sich um den Neustart und Cache-Clearing.
