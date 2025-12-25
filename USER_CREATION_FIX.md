# User Creation Fix - Onboarding Process

## Problem
When running `migrate:fresh` (without `--seed`) and completing the onboarding process manually, users would get a foreign key error when trying to create bookings:
```
Foreign key violation: user_id = 1 does not exist in users table
```

## Root Cause
- Journal entries require a `user_id` 
- The seeder creates a user, but manual onboarding didn't
- This caused a mismatch between the two setup methods

## Solution
Updated `OnboardingController::complete()` to automatically create a default user if none exists when completing the onboarding process.

### User Creation Logic
```php
if (\App\Models\User::count() === 0) {
    \App\Models\User::create([
        'name' => $settings->company_name ?? 'Admin',
        'email' => $settings->email ?? 'admin@company.local',
        'password' => bcrypt('password'),
        'email_verified_at' => now(),
    ]);
}
```

### Default Credentials
When created during onboarding:
- **Name**: Uses company name from settings
- **Email**: Uses company email, or generates from company name
- **Password**: `password` (should be changed after first login)

## Testing

### Test 1: Fresh Migration with Seed
```bash
wsl vendor/bin/sail artisan migrate:fresh --seed
```
**Expected**: User created by seeder, can create bookings ✅

### Test 2: Fresh Migration WITHOUT Seed (Manual Onboarding)
```bash
# 1. Reset database
wsl vendor/bin/sail artisan migrate:fresh

# 2. Go through onboarding
- Navigate to /onboarding
- Fill company settings
- Select business model
- Select legal form  
- Generate account plan
- Complete onboarding

# 3. Try to create a booking
```
**Expected**: User created automatically during onboarding completion, can create bookings ✅

## Files Modified
1. `app/Http/Controllers/Api/OnboardingController.php` - Added user creation logic
2. `database/seeders/CompanySettingSeeder.php` - Already creates user with demo data

## Benefits
- ✅ Consistent behavior between seeded and manual setup
- ✅ No more foreign key errors
- ✅ User created with company information
- ✅ Single-user application works out of the box
