#!/bin/bash

# Multi-Tenant Setup Script
# Run this after implementing multi-tenancy to set up the database

echo "🚀 Setting up Multi-Tenant SaaS..."

# Step 1: Publish Sanctum migrations
echo "📦 Publishing Sanctum migrations..."
./vendor/bin/sail artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"

# Step 2: Create sessions table (for database session driver)
echo "📦 Creating sessions table..."
./vendor/bin/sail artisan session:table

# Step 3: Dump autoloader
echo "♻️  Dumping autoloader..."
./vendor/bin/sail composer dump-autoload

# Step 4: Run all migrations
echo "🗄️  Running migrations..."
./vendor/bin/sail artisan migrate

# Step 5: Clear caches
echo "🧹 Clearing caches..."
./vendor/bin/sail artisan config:clear
./vendor/bin/sail artisan route:clear
./vendor/bin/sail artisan cache:clear

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Visit http://localhost/ to see the welcome page"
echo "2. Visit http://localhost/default/dashboard to access your existing data"
echo "3. Visit http://localhost/register to create a new tenant"
echo ""


# DON'T run this again (it creates duplicate files):
# ./vendor/bin/sail artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"

# ONLY run these:
./vendor/bin/sail artisan session:table
./vendor/bin/sail composer dump-autoload  
./vendor/bin/sail artisan migrate
./vendor/bin/sail artisan config:clear
./vendor/bin/sail artisan route:clear


Remove-Item "\\wsl.localhost\Ubuntu\home\ahmed\LaravelProjects\at-book\database\migrations\2025_12_25_185336_create_personal_access_tokens_table.php", "\\wsl.localhost\Ubuntu\home\ahmed\LaravelProjects\at-book\database\migrations\2025_12_25_190404_create_personal_access_tokens_table.php"