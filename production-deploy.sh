#!/bin/bash

# Stop existing containers if running
docker compose -f compose.production.yaml down

# Build (if needed) and Start containers in detached mode
echo "Starting production containers..."
docker compose -f compose.production.yaml up -d --build

# Wait for database to be ready
echo "Waiting for database..."
sleep 10

# Install PHP dependencies
echo "Installing Composer dependencies..."
docker compose -f compose.production.yaml exec -T at-book composer install --no-dev --optimize-autoloader

# Install Node dependencies and build assets
echo "Building Frontend assets..."
docker compose -f compose.production.yaml exec -T at-book npm install
docker compose -f compose.production.yaml exec -T at-book npm run build

# Run Database Migrations
echo "Running Migrations..."
docker compose -f compose.production.yaml exec -T at-book php artisan migrate --force

# Run Seeder
echo "Running Seeders..."
docker compose -f compose.production.yaml exec -T at-book php artisan db:seed --class=RolePermissionSeeder --force

# Clear and Cache configuration
echo "Optimizing Cache..."
docker compose -f compose.production.yaml exec -T at-book php artisan optimize:clear
docker compose -f compose.production.yaml exec -T at-book php artisan config:cache
docker compose -f compose.production.yaml exec -T at-book php artisan route:cache
docker compose -f compose.production.yaml exec -T at-book php artisan view:cache

echo "Deployment finished successfully!"
