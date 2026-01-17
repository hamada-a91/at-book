<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolePermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // create permissions
        $permissions = [
            'user.view',
            'user.create',
            'user.edit',
            'user.delete',
            'invoice.view',
            'invoice.create',
            'invoice.edit',
            'invoice.delete',
            // Add more as needed
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'api']);
        }

        // create roles and assign created permissions

        // Owner: All permissions
        $role = Role::firstOrCreate(['name' => 'owner', 'guard_name' => 'api']);
        $role->givePermissionTo(Permission::where('guard_name', 'api')->get());

        // Manager: All except user.delete
        $role = Role::firstOrCreate(['name' => 'manager', 'guard_name' => 'api']);
        $role->givePermissionTo(Permission::where('guard_name', 'api')->get());
        $role->revokePermissionTo('user.delete');

        // Cachier: Only invoices
        $role = Role::firstOrCreate(['name' => 'cachier', 'guard_name' => 'api']);
        $role->givePermissionTo(Permission::where('guard_name', 'api')->whereIn('name', [
            'invoice.view',
            'invoice.create',
            'invoice.edit',
        ])->get());

        // Buchhalter: View invoices/financials
        $role = Role::firstOrCreate(['name' => 'buchhalter', 'guard_name' => 'api']);
        $role->givePermissionTo(Permission::where('guard_name', 'api')->whereIn('name', ['invoice.view'])->get());

        // Admin: Super admin
        $role = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'api']);
        $role->givePermissionTo(Permission::where('guard_name', 'api')->get());

        
    }
}
