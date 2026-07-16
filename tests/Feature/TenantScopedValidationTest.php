<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\TenantTestData;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

/**
 * SPEC-03, Akzeptanzkriterium: User von Tenant B darf in keinem POST-Request
 * IDs referenzieren, die einem anderen Tenant (A) gehören - erwartet: 422,
 * kein Datensatz angelegt. Mit den eigenen IDs (Tenant B) muss derselbe
 * Request weiterhin funktionieren (Regression für den Happy Path).
 */
class TenantScopedValidationTest extends TestCase
{
    use RefreshDatabase;

    private TenantTestData $tenantA;

    private TenantTestData $tenantB;

    protected function setUp(): void
    {
        parent::setUp();

        // Zwei komplette, unabhängige Tenant-Datenbestände (SPEC-02-Infrastruktur).
        $this->tenantA = TenantTestDataFactory::create('a');
        $this->tenantB = TenantTestDataFactory::create('b');
    }

    /**
     * Liefert einen Bearer-Token für den Owner von Tenant B (JWT, Guard "api").
     * Der HTTP-Request durchläuft danach SetTenantFromUser und setzt
     * currentTenant korrekt auf Tenant B - unabhängig vom Zustand, den
     * TenantTestDataFactory zuletzt im Container hinterlassen hat.
     */
    private function tokenForTenantB(): string
    {
        return auth('api')->login($this->tenantB->user);
    }

    private function tokenForTenantA(): string
    {
        return auth('api')->login($this->tenantA->user);
    }

    // -----------------------------------------------------------------
    // POST /api/bookings
    // -----------------------------------------------------------------

    public function test_booking_with_foreign_account_id_is_rejected(): void
    {
        $token = $this->tokenForTenantB();

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/bookings', [
            'date' => '2026-07-01',
            'description' => 'Fremdzugriff-Versuch',
            'lines' => [
                ['account_id' => $this->tenantA->accountBank->id, 'type' => 'debit', 'amount' => 1000],
                ['account_id' => $this->tenantB->accountExpense->id, 'type' => 'credit', 'amount' => 1000],
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['lines.0.account_id']);

        $this->assertDatabaseMissing('journal_entries', [
            'description' => 'Fremdzugriff-Versuch',
        ]);
    }

    public function test_booking_with_own_account_ids_succeeds(): void
    {
        $token = $this->tokenForTenantB();

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/bookings', [
            'date' => '2026-07-01',
            'description' => 'Legitime Buchung',
            'lines' => [
                ['account_id' => $this->tenantB->accountBank->id, 'type' => 'debit', 'amount' => 1000],
                ['account_id' => $this->tenantB->accountExpense->id, 'type' => 'credit', 'amount' => 1000],
            ],
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('journal_entries', [
            'description' => 'Legitime Buchung',
            'tenant_id' => $this->tenantB->tenant->id,
        ]);
    }

    // -----------------------------------------------------------------
    // POST /api/invoices
    // -----------------------------------------------------------------

    public function test_invoice_with_foreign_contact_id_is_rejected(): void
    {
        $token = $this->tokenForTenantB();

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/invoices', [
            'contact_id' => $this->tenantA->customer->id,
            'invoice_date' => '2026-07-01',
            'due_date' => '2026-07-15',
            'lines' => [
                [
                    'description' => 'Testposition',
                    'quantity' => 1,
                    'unit_price' => 10000,
                    'tax_rate' => 19,
                    'account_id' => $this->tenantB->accountRevenue->id,
                ],
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['contact_id']);

        // Nicht global prüfen (Tenant A hat legitim eine Seed-Rechnung mit
        // dieser contact_id) - sondern dass Tenant B keine Rechnung auf
        // diesen fremden Kontakt anlegen konnte.
        $this->assertDatabaseMissing('invoices', [
            'contact_id' => $this->tenantA->customer->id,
            'tenant_id' => $this->tenantB->tenant->id,
        ]);
    }

    public function test_invoice_with_foreign_line_account_id_is_rejected(): void
    {
        $token = $this->tokenForTenantB();

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/invoices', [
            'contact_id' => $this->tenantB->customer->id,
            'invoice_date' => '2026-07-01',
            'due_date' => '2026-07-15',
            'lines' => [
                [
                    'description' => 'Testposition',
                    'quantity' => 1,
                    'unit_price' => 10000,
                    'tax_rate' => 19,
                    'account_id' => $this->tenantA->accountRevenue->id,
                ],
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['lines.0.account_id']);

        // Nur die Seed-Rechnung aus der Factory für Tenant B darf existieren,
        // keine zusätzliche durch diesen (abgelehnten) Request.
        $this->assertSame(
            1,
            \App\Models\Invoice::where('tenant_id', $this->tenantB->tenant->id)->count()
        );
    }

    public function test_invoice_with_own_ids_succeeds(): void
    {
        $token = $this->tokenForTenantB();

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/invoices', [
            'contact_id' => $this->tenantB->customer->id,
            'invoice_date' => '2026-07-01',
            'due_date' => '2026-07-15',
            'lines' => [
                [
                    'description' => 'Testposition',
                    'quantity' => 1,
                    'unit_price' => 10000,
                    'tax_rate' => 19,
                    'account_id' => $this->tenantB->accountRevenue->id,
                ],
            ],
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('invoices', [
            'contact_id' => $this->tenantB->customer->id,
            'tenant_id' => $this->tenantB->tenant->id,
        ]);
    }

    // -----------------------------------------------------------------
    // POST /api/belege
    // -----------------------------------------------------------------

    public function test_beleg_with_foreign_contact_id_is_rejected(): void
    {
        $token = $this->tokenForTenantB();

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/belege', [
            'document_type' => 'eingang',
            'title' => 'Fremdzugriff-Beleg',
            'document_date' => '2026-07-01',
            'amount' => 1190,
            'contact_id' => $this->tenantA->vendor->id,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['contact_id']);

        $this->assertDatabaseMissing('belege', [
            'title' => 'Fremdzugriff-Beleg',
        ]);
    }

    public function test_beleg_with_own_contact_id_succeeds(): void
    {
        $token = $this->tokenForTenantB();

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/belege', [
            'document_type' => 'eingang',
            'title' => 'Legitimer Beleg',
            'document_date' => '2026-07-01',
            'amount' => 1190,
            'contact_id' => $this->tenantB->vendor->id,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('belege', [
            'title' => 'Legitimer Beleg',
            'contact_id' => $this->tenantB->vendor->id,
            'tenant_id' => $this->tenantB->tenant->id,
        ]);
    }

    // -----------------------------------------------------------------
    // Sanity check: tokenForTenantA arbeitet unabhängig (kein Cross-Talk)
    // -----------------------------------------------------------------

    public function test_tenant_a_can_still_book_with_its_own_ids(): void
    {
        $token = $this->tokenForTenantA();

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/bookings', [
            'date' => '2026-07-01',
            'description' => 'Tenant A Buchung',
            'lines' => [
                ['account_id' => $this->tenantA->accountBank->id, 'type' => 'debit', 'amount' => 500],
                ['account_id' => $this->tenantA->accountExpense->id, 'type' => 'credit', 'amount' => 500],
            ],
        ]);

        $response->assertStatus(201);
    }
}
