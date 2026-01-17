<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create Admin User
        $user = \App\Models\User::firstOrCreate(
            ['email' => 'ahmed.tahhan@web.de'],
            [
                'name' => 'Ahmed Tahhan',
                'password' => \Illuminate\Support\Facades\Hash::make('AT-book1987'),
                'tenant_id' => null, // Explicitly null
            ]
        );

        // Ensure proper guard for role verification
        $user->guard_name = 'api';
        
        // Create admin role if not exists (should be handled by RolePermissionSeeder but safe to check)
        $role = \Spatie\Permission\Models\Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'api']);
        
        // Assign Role
        if (!$user->hasRole('admin')) {
            $user->assignRole($role);
        }
    }
}
