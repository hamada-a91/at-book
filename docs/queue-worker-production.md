# Queue Worker für Production - Supervisor Konfiguration

## Übersicht

Für den Production-Server muss der Queue Worker dauerhaft laufen. Dafür verwenden wir **Supervisor**, einen Process Manager der den Worker automatisch startet und bei Abstürzen neu startet.

---

## Option 1: Supervisor (empfohlen für Linux-Server)

### 1. Supervisor installieren

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install supervisor

# CentOS/RHEL
sudo yum install supervisor
```

### 2. Konfigurationsdatei erstellen

```bash
sudo nano /etc/supervisor/conf.d/at-book-worker.conf
```

Inhalt:

```ini
[program:at-book-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/at-book/artisan queue:work --queue=backups --sleep=3 --tries=1 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=1
redirect_stderr=true
stdout_logfile=/var/www/at-book/storage/logs/worker.log
stopwaitsecs=3600
```

### 3. Supervisor konfiguration laden

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start at-book-worker:*
```

### 4. Status prüfen

```bash
sudo supervisorctl status
```

### 5. Nach Code-Deployment Worker neustarten

```bash
# Nach jedem Deployment:
php artisan queue:restart
```

---

## Option 2: Systemd (für moderne Linux-Server)

### 1. Service-Datei erstellen

```bash
sudo nano /etc/systemd/system/at-book-worker.service
```

Inhalt:

```ini
[Unit]
Description=AT-Book Queue Worker
After=network.target

[Service]
User=www-data
Group=www-data
Restart=always
RestartSec=5
WorkingDirectory=/var/www/at-book
ExecStart=/usr/bin/php artisan queue:work --queue=backups --sleep=3 --tries=1 --max-time=3600
ExecReload=/bin/kill -s HUP $MAINPID
StandardOutput=append:/var/www/at-book/storage/logs/worker.log
StandardError=append:/var/www/at-book/storage/logs/worker-error.log

[Install]
WantedBy=multi-user.target
```

### 2. Service aktivieren und starten

```bash
sudo systemctl daemon-reload
sudo systemctl enable at-book-worker
sudo systemctl start at-book-worker
```

### 3. Status prüfen

```bash
sudo systemctl status at-book-worker
```

---

## Option 3: Laravel Forge / Sevalla / Ploi

Wenn Sie einen Managed Hosting Service nutzen:

### Laravel Forge:
1. Site → Queue → Create Queue Worker
2. Queue: `backups`
3. Timeout: `3600`

### Sevalla:
1. Worker in der sevalla.yaml definieren:
```yaml
workers:
  backup-worker:
    command: php artisan queue:work --queue=backups --sleep=3 --tries=1 --max-time=3600
```

---

## Option 4: Docker / Kubernetes

### docker-compose.yml

```yaml
services:
  queue-worker:
    image: your-app-image
    command: php artisan queue:work --queue=backups --sleep=3 --tries=1 --max-time=3600
    restart: always
    depends_on:
      - app
      - redis
    volumes:
      - .:/var/www/html
```

---

## PHP Konfiguration (wichtig!)

Für lange Backup-Jobs muss PHP angepasst werden:

```ini
; php.ini
max_execution_time = 3600
memory_limit = 512M
```

---

## Deployment-Workflow

Bei jedem Deployment müssen Sie den Queue Worker neu starten:

```bash
# 1. Maintenance Mode aktivieren
php artisan down

# 2. Code deployen (git pull, etc.)
git pull origin main

# 3. Composer dependencies
composer install --no-dev --optimize-autoloader

# 4. Cache leeren
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 5. Migrationen ausführen
php artisan migrate --force

# 6. Queue Worker neustarten (WICHTIG!)
php artisan queue:restart

# 7. Maintenance Mode deaktivieren
php artisan up
```

---

## Monitoring

### Log-Dateien prüfen

```bash
tail -f storage/logs/worker.log
```

### Failed Jobs prüfen

```bash
php artisan queue:failed
```

### Failed Jobs erneut versuchen

```bash
php artisan queue:retry all
```

---

## Troubleshooting

### Worker läuft nicht

```bash
# Prüfen ob Worker läuft
ps aux | grep queue:work

# Logs prüfen
tail -100 storage/logs/worker.log
```

### Jobs hängen fest

```sql
-- Via Datenbank: Stuck Jobs auf cancelled setzen
UPDATE backup_jobs 
SET status = 'cancelled' 
WHERE status IN ('pending', 'processing');
```

Oder via Artisan:
```bash
php artisan tinker
>>> \App\Models\BackupJob::whereIn('status', ['pending', 'processing'])->update(['status' => 'cancelled']);
```

### Memory-Probleme bei großen Backups

```bash
# Worker mit höherem Memory-Limit starten
php -d memory_limit=1G artisan queue:work --queue=backups
```
