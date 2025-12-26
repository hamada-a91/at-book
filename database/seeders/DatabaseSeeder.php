<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     * 
     * NOTE: For multi-tenant applications, we don't seed demo data.
     * Each tenant creates their own data through the onboarding process.
     */
    public function run(): void
    {
        // No seeding needed - tenants create their own data via onboarding
        $this->command->info('✅ Multi-tenant app - no seeding required. Use onboarding to create data.');
    }
}
