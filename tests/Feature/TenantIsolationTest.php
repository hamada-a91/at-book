<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Contacts\Models\Contact;
use Illuminate\Foundation\Testing\RefreshDatabase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that tenant scoping works correctly
     */
    public function test_tenant_scoping_isolates_data()
    {
        // Create two tenants
        $tenantA = Tenant::create(['name' => 'Tenant A', 'slug' => 'tenant-a']);
        $tenantB = Tenant::create(['name' => 'Tenant B', 'slug' => 'tenant-b']);

        // Set current tenant to A
        app()->instance('currentTenant', $tenantA);

        // Create data for Tenant A
        $accountA = Account::create([
            'code' => '1000',
            'name' => 'Cash Account A',
            'type' => 'asset',
        ]);

        $contactA = Contact::create([
            'name' => 'Customer A',
            'type' => 'customer',
        ]);

        // Verify data belongs to Tenant A
        $this->assertEquals($tenantA->id, $accountA->fresh()->tenant_id);
        $this->assertEquals($tenantA->id, $contactA->fresh()->tenant_id);

        // Switch to Tenant B
        app()->instance('currentTenant', $tenantB);

        // Tenant B should not see Tenant A's data
        $this->assertCount(0, Account::all());
        $this->assertCount(0, Contact::all());

        // Create data for Tenant B
        $accountB = Account::create([
            'code' => '2000',
            'name' => 'Cash Account B',
            'type' => 'asset',
        ]);

        // Tenant B should only see their own data
        $this->assertCount(1, Account::all());
        $this->assertEquals('Cash Account B', Account::first()->name);

        // Switch back to Tenant A
        app()->instance('currentTenant', $tenantA);

        // Tenant A should only see their own data
        $this->assertCount(1, Account::all());
        $this->assertEquals('Cash Account A', Account::first()->name);
    }

    /**
     * Test that registration creates tenant and user correctly
     */
    public function test_registration_creates_tenant_and_user()
    {
        $response = $this->postJson('/api/register', [
            'company_name' => 'Test Company',
            'slug' => 'test-company',
            'name' => 'John Doe',
            'email' => 'john@test.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(201);
        $response->assertJson([
            'message' => 'Registration successful',
        ]);

        // Verify tenant was created
        $this->assertDatabaseHas('tenants', [
            'name' => 'Test Company',
            'slug' => 'test-company',
        ]);

        // Verify user was created and linked to tenant
        $tenant = Tenant::where('slug', 'test-company')->first();
        $this->assertDatabaseHas('users', [
            'name' => 'John Doe',
            'email' => 'john@test.com',
            'tenant_id' => $tenant->id,
        ]);

        // Verify company settings was created
        $this->assertDatabaseHas('company_settings', [
            'company_name' => 'Test Company',
            'tenant_id' => $tenant->id,
        ]);
    }

    /**
     * Test that users can only see their own tenant's data after login
     */
    public function test_users_only_see_own_tenant_data()
    {
        // Create two tenants with users
        $tenantA = Tenant::create(['name' => 'Tenant A', 'slug' => 'tenant-a']);
        $userA = User::factory()->create(['tenant_id' => $tenantA->id]);

        $tenantB = Tenant::create(['name' => 'Tenant B', 'slug' => 'tenant-b']);
        $userB = User::factory()->create(['tenant_id' => $tenantB->id]);

        // Create data for each tenant
        app()->instance('currentTenant', $tenantA);
        Account::create(['code' => '1000', 'name' => 'Account A', 'type' => 'asset']);

        app()->instance('currentTenant', $tenantB);
        Account::create(['code' => '2000', 'name' => 'Account B', 'type' => 'asset']);

        // Login as user A
        $this->actingAs($userA);
        app()->instance('currentTenant', $tenantA);

        // User A should only see Tenant A's accounts
        $accounts = Account::all();
        $this->assertCount(1, $accounts);
        $this->assertEquals('Account A', $accounts->first()->name);

        // Login as user B
        $this->actingAs($userB);
        app()->instance('currentTenant', $tenantB);

        // User B should only see Tenant B's accounts
        $accounts = Account::all();
        $this->assertCount(1, $accounts);
        $this->assertEquals('Account B', $accounts->first()->name);
    }
}
