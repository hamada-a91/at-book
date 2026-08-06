<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminUserSeeder extends Seeder
{
    /**
     * Erstellt den Plattform-Admin (tenant-los, Rolle "admin").
     *
     * Zugangsdaten kommen aus der Umgebung (ADMIN_EMAIL / ADMIN_PASSWORD,
     * siehe config/atbook.php). Ohne ADMIN_PASSWORD wird ein Zufallspasswort
     * generiert und einmalig ausgegeben – niemals Passwörter hardcoden!
     */
    public function run(): void
    {
        $email = config('atbook.admin_email');
        $password = config('atbook.admin_password');

        $generated = false;
        if (empty($password)) {
            $password = Str::password(20);
            $generated = true;
        }

        $user = \App\Models\User::updateOrCreate(
            ['email' => $email],
            [
                'name' => config('atbook.admin_name'),
                'password' => Hash::make($password),
                'tenant_id' => null, // Plattform-Admin gehört zu keinem Tenant
            ]
        );

        $role = \Spatie\Permission\Models\Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'api']);

        if (! $user->hasRole('admin')) {
            $user->assignRole($role);
        }

        if ($user->wasRecentlyCreated && $generated) {
            $this->command->warn("⚠️  Admin-Passwort generiert (einmalige Anzeige!): {$password}");
            $this->command->line('   Setze ADMIN_PASSWORD in der .env, um ein eigenes zu verwenden.');
        }

        $this->command->info("✅ Plattform-Admin: {$email}");
    }
}
