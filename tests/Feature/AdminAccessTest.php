<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AdminAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Roles must exist for guard "api" (see RolePermissionSeeder / AdminUserSeeder).
        Role::firstOrCreate(['name' => 'owner', 'guard_name' => 'api']);
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'api']);
    }

    protected function tokenFor(User $user): string
    {
        return auth('api')->login($user);
    }

    public function test_guest_gets_401_on_admin_stats(): void
    {
        $response = $this->getJson('/api/admin/stats');

        $response->assertStatus(401);
    }

    public function test_tenant_user_without_admin_role_gets_403_on_admin_routes(): void
    {
        $tenant = Tenant::create(['name' => 'Tenant A', 'slug' => 'tenant-a']);

        $owner = User::factory()->create(['tenant_id' => $tenant->id]);
        $owner->assignRole('owner');

        $token = $this->tokenFor($owner);

        foreach (['/api/admin/stats', '/api/admin/tenants', '/api/admin/users'] as $endpoint) {
            $response = $this->withHeader('Authorization', "Bearer {$token}")->getJson($endpoint);

            $response->assertStatus(403);
        }
    }

    public function test_admin_user_gets_200_on_admin_stats(): void
    {
        $admin = User::factory()->create(['tenant_id' => null]);
        $admin->assignRole('admin');

        $token = $this->tokenFor($admin);

        $response = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/admin/stats');

        $response->assertStatus(200);
        $response->assertJsonStructure(['tenants_count', 'users_count', 'bugs_count']);
    }
}
