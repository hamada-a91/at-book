<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Contacts\Models\Contact;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NeutralContactTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_neutral_contact_with_new_account()
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $response = $this->postJson('/api/contacts', [
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
        $user = User::factory()->create();
        $this->actingAs($user);

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
        $response = $this->postJson('/api/bookings', [
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
                ]
            ]
        ]);

        $response->assertStatus(201);

        // Verify booking exists
        $this->assertDatabaseHas('journal_entries', [
            'description' => 'Loan Repayment',
            'contact_id' => $contact->id,
        ]);
    }
}
