<?php

namespace Tests\Feature;

use App\Models\CompanySetting;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Contacts\Models\Contact;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Ursprünglich 2 rote Tests (SPEC-02, Aufgabe 4): reines Test-Setup-Problem,
 * kein App-Bug. Ursache: $this->actingAs($user) authentifiziert gegen den
 * DEFAULT-Guard ("web"), die API-Routen laufen aber unter der Middleware
 * auth:api (JWT, siehe routes/api.php) - der Request kam daher als Gast an
 * (401 statt 201). Zusätzlich hatte der User keinen Tenant, wodurch
 * SetTenantFromUser keinen currentTenant() setzen konnte und
 * BelongsToTenant beim Account-Insert ein NULL tenant_id produzierte
 * (NOT-NULL-Constraint-Verletzung). Fix: Tenant anlegen, User dem Tenant
 * zuordnen, per auth('api')->login() + Bearer-Header authentifizieren
 * (siehe gleiches Muster in AdminAccessTest/ReportsStornoTest) und
 * onboarding_completed=true setzen, damit die onboarding.complete-Middleware
 * die Routen nicht blockiert.
 */
class NeutralContactTest extends TestCase
{
    use RefreshDatabase;

    private function authenticatedTenantUser(): User
    {
        $tenant = Tenant::create(['name' => 'Neutral Contact Test GmbH', 'slug' => 'neutral-contact-test']);
        $user = User::factory()->create(['tenant_id' => $tenant->id]);

        app()->instance('currentTenant', $tenant);
        CompanySetting::create([
            'company_name' => $tenant->name,
            'onboarding_completed' => true,
        ]);

        return $user;
    }

    public function test_create_neutral_contact_with_new_account()
    {
        $user = $this->authenticatedTenantUser();
        $token = auth('api')->login($user);

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/contacts', [
            'name' => 'Neutral Contact With Account',
            'type' => 'other',
            'account_code' => '9999',
            'account_name' => 'Private Loan Account',
            'account_type' => 'liability',
        ]);

        $response->assertStatus(201);

        // Check Contact
        $this->assertDatabaseHas('contacts', [
            'name' => 'Neutral Contact With Account',
            'type' => 'other',
        ]);

        $contact = Contact::where('name', 'Neutral Contact With Account')->first();
        $this->assertNotNull($contact->account_id);

        // Check Account
        $this->assertDatabaseHas('accounts', [
            'code' => '9999',
            'name' => 'Private Loan Account',
            'type' => 'liability',
        ]);

        $this->assertEquals($contact->account_id, Account::where('code', '9999')->first()->id);
    }

    public function test_booking_for_neutral_contact()
    {
        $user = $this->authenticatedTenantUser();
        $token = auth('api')->login($user);

        // Create a neutral contact with an account
        $account = Account::create([
            'code' => '9999',
            'name' => 'Private Loan Account',
            'type' => 'liability',
            'is_system' => false,
        ]);

        $contact = Contact::create([
            'name' => 'Neutral Booking Test',
            'type' => 'other',
            'account_id' => $account->id,
        ]);

        // Create a bank account
        $bankAccount = Account::create([
            'code' => '1200',
            'name' => 'Bank',
            'type' => 'asset',
            'is_system' => false,
        ]);

        // Create a booking manually
        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/bookings', [
            'date' => '2025-12-02',
            'description' => 'Loan Repayment',
            'contact_id' => $contact->id,
            'lines' => [
                [
                    'account_id' => $account->id,
                    'type' => 'debit',
                    'amount' => 10000, // 100.00
                ],
                [
                    'account_id' => $bankAccount->id,
                    'type' => 'credit',
                    'amount' => 10000,
                ],
            ],
        ]);

        $response->assertStatus(201);

        // Verify booking exists
        $this->assertDatabaseHas('journal_entries', [
            'description' => 'Loan Repayment',
            'contact_id' => $contact->id,
        ]);
    }
}
