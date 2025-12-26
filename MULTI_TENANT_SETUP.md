# Multi-Tenant SaaS Setup Commands

## Quick Fix (If Sanctum Already Installed)

If you get "personal_access_tokens already exists" error, run this instead:

```bash
# 1. Create sessions table migration
./vendor/bin/sail artisan session:table

# 2. Dump autoloader
./vendor/bin/sail composer dump-autoload

# 3. Run only the new migrations
./vendor/bin/sail artisan migrate

# 4. Clear caches
./vendor/bin/sail artisan config:clear
./vendor/bin/sail artisan route:clear
```

---

## Full Setup (Fresh Install)

### Automatic Setup
Run this single script to set everything up:

```bash
chmod +x setup-multi-tenant.sh
./setup-multi-tenant.sh
```

### Manual Setup

If you prefer to run commands manually:

```bash
# 1. Publish Sanctum configuration and migrations (skip if already done)
./vendor/bin/sail artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"

# 2. Create sessions table migration
./vendor/bin/sail artisan session:table

# 3. Dump autoloader to load helpers.php
./vendor/bin/sail composer dump-autoload

# 4. Run migrations to create tenant tables, Sanctum tables, and sessions table
./vendor/bin/sail artisan migrate

# 4. Seed the account plan for the default tenant (optional - only if you haven't seeded yet)
./vendor/bin/sail artisan db:seed --class=AccountSeeder

# 5. Clear caches
./vendor/bin/sail artisan config:clear
./vendor/bin/sail artisan route:clear
./vendor/bin/sail artisan cache:clear
```

After running these commands:
- All existing data will be assigned to a "Default" tenant (slug: "default")
- You can access the existing app at: `http://localhost/default/dashboard`
- New users can register at: `http://localhost/register`
- Login page: `http://localhost/login`
