<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Basis-Seeding: Rollen/Permissions + Plattform-Admin (immer nötig).
     * In lokalen Umgebungen zusätzlich ein kompletter Demo-Tenant zum Testen.
     *
     * Fachdaten der Mandanten entstehen normal über Registrierung + Onboarding.
     */
    public function run(): void
    {
        $this->call([
            RolePermissionSeeder::class,
            AdminUserSeeder::class,
        ]);

        if (app()->environment('local', 'testing')) {
            $this->call(DemoTenantSeeder::class);
        }
    }
}
