#!/bin/bash

# ===============================================
# Fresh Multi-Tenant Database Reset Script
# ===============================================
# This script completely resets the database and
# sets up a fresh multi-tenant installation

echo "🔄 Starting Fresh Database Reset..."
echo "=================================="
echo ""

# Step 1: Clean up and run fresh migrations
echo "📦 Publishing migrations..."
# Remove old Sanctum migrations if they exist (we use JWT now)
rm -f database/migrations/*_personal_access_tokens_table.php

# Run fresh migrations
./vendor/bin/sail artisan migrate:fresh
echo "   ✓ Database reset complete"
echo ""

# Step 3: Create sessions table
echo "📋 Step 3: Creating sessions table migration..."
./vendor/bin/sail artisan session:table 2>/dev/null || echo "   ℹ️  Sessions table migration already exists"
echo ""

# Step 4: Run migrations
echo "🔼 Step 4: Running all migrations..."
./vendor/bin/sail artisan migrate --force
echo "   ✓ All migrations applied"
echo ""

# Step 5: Dump autoloader
echo "♻️  Step 5: Dumping autoloader..."
./vendor/bin/sail composer dump-autoload --quiet
echo "   ✓ Autoloader refreshed"
echo ""

# Step 6: Clear all caches
echo "🧹 Step 6: Clearing all caches..."
./vendor/bin/sail artisan config:clear
./vendor/bin/sail artisan route:clear
./vendor/bin/sail artisan cache:clear
./vendor/bin/sail artisan view:clear
echo "   ✓ All caches cleared"
echo ""

echo "=================================="
echo "✅ Fresh installation complete!"
echo "=================================="
echo ""
echo "⚠️  CRITICAL: Clear your browser's localStorage!"
echo "   1. Open browser DevTools (F12)"
echo "   2. Go to: Application → Local Storage"
echo "   3. Right-click → Clear"
echo "   OR run in console: localStorage.clear()"
echo ""
echo "📌 Next Steps:"
echo "   1. Clear browser localStorage (see above)"
echo "   2. Hard refresh browser (Ctrl+Shift+R)"
echo "   3. Visit http://localhost/register"
echo "   4. Create your first tenant"
echo "   5. Complete the onboarding process"
echo ""
echo "🎯 Test URLs:"
echo "   • Welcome:      http://localhost/"
echo "   • Register:     http://localhost/register"
echo "   • Login:        http://localhost/login"
echo ""
