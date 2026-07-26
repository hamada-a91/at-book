<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Projects\Models\CostCenter;
use App\Modules\Projects\Models\CostObject;
use App\Modules\Projects\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\Support\TenantTestData;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

/**
 * SPEC-08 (Teil A): Projekte, Kostenstellen & Kostenträger - Akzeptanzkriterien.
 */
class ProjectsCostCentersTest extends TestCase
{
    use RefreshDatabase;

    private TenantTestData $data;

    protected function setUp(): void
    {
        parent::setUp();

        $this->data = TenantTestDataFactory::create('spec08');
    }

    private function tokenFor(User $user): string
    {
        return auth('api')->login($user);
    }

    private function ownerToken(): string
    {
        return $this->tokenFor($this->data->user);
    }

    // -----------------------------------------------------------------
    // Durchreich-Logik
    // -----------------------------------------------------------------

    public function test_invoice_with_project_id_books_journal_lines_with_project_cost_object(): void
    {
        $token = $this->ownerToken();

        $projectResponse = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/projects', [
            'name' => 'Website Relaunch',
            'contact_id' => $this->data->customer->id,
            'budget_amount' => 500000,
        ]);
        $projectResponse->assertStatus(201);
        $costObjectId = $projectResponse->json('cost_object_id');
        $this->assertNotNull($costObjectId);

        $invoiceResponse = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/invoices', [
            'contact_id' => $this->data->customer->id,
            'project_id' => $projectResponse->json('id'),
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(14)->toDateString(),
            'lines' => [
                [
                    'description' => 'Konzeption',
                    'quantity' => 1,
                    'unit_price' => 100000,
                    'tax_rate' => 19,
                    'account_id' => $this->data->accountRevenue->id,
                ],
            ],
        ]);
        $invoiceResponse->assertStatus(201);
        $invoiceId = $invoiceResponse->json('id');

        $bookResponse = $this->withHeader('Authorization', "Bearer {$token}")->postJson("/api/invoices/{$invoiceId}/book");
        $bookResponse->assertStatus(200);

        $journalEntry = \App\Modules\Accounting\Models\JournalEntry::with('lines')->findOrFail($bookResponse->json('journal_entry_id'));

        $this->assertGreaterThan(0, $journalEntry->lines->count());
        foreach ($journalEntry->lines as $line) {
            $this->assertSame((int) $costObjectId, (int) $line->cost_object_id, "Journalzeile Konto {$line->account_id} muss den Kostenträger des Projekts tragen.");
        }
    }

    public function test_line_dimension_overrides_document_default(): void
    {
        $token = $this->ownerToken();

        $projectResponse = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/projects', [
            'name' => 'Website Relaunch',
            'contact_id' => $this->data->customer->id,
        ]);
        $projectResponse->assertStatus(201);
        $projectCostObjectId = $projectResponse->json('cost_object_id');

        $overrideCostObject = CostObject::create(['code' => 'CO-OVERRIDE', 'name' => 'Sonderkostenträger', 'active' => true]);

        $invoiceResponse = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/invoices', [
            'contact_id' => $this->data->customer->id,
            'project_id' => $projectResponse->json('id'),
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(14)->toDateString(),
            'lines' => [
                [
                    'description' => 'Position mit eigenem Kostenträger',
                    'quantity' => 1,
                    'unit_price' => 50000,
                    'tax_rate' => 19,
                    'account_id' => $this->data->accountRevenue->id,
                    'cost_object_id' => $overrideCostObject->id,
                ],
            ],
        ]);
        $invoiceResponse->assertStatus(201);
        $invoiceId = $invoiceResponse->json('id');

        $bookResponse = $this->withHeader('Authorization', "Bearer {$token}")->postJson("/api/invoices/{$invoiceId}/book");
        $bookResponse->assertStatus(200);

        $journalEntry = \App\Modules\Accounting\Models\JournalEntry::with('lines.account')->findOrFail($bookResponse->json('journal_entry_id'));

        $revenueLine = $journalEntry->lines->first(fn ($l) => $l->account->type === 'revenue');
        $this->assertNotNull($revenueLine);
        $this->assertSame($overrideCostObject->id, $revenueLine->cost_object_id, 'Zeilen-Override muss den Dokument-Default überschreiben.');

        $debitorLine = $journalEntry->lines->first(fn ($l) => $l->account->type === 'asset');
        $this->assertNotNull($debitorLine);
        $this->assertSame((int) $projectCostObjectId, (int) $debitorLine->cost_object_id, 'Debitor-Zeile hat keinen Line-Ursprung und bleibt beim Dokument-Default.');
    }

    // -----------------------------------------------------------------
    // Internes Projekt & Summary
    // -----------------------------------------------------------------

    public function test_internal_project_without_contact_can_be_created_and_summary_works(): void
    {
        $token = $this->ownerToken();

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/projects', [
            'name' => 'BieneB',
            'budget_amount' => 100000,
        ]);
        $response->assertStatus(201);
        $response->assertJsonPath('contact_id', null);
        $projectId = $response->json('id');

        $summary = $this->withHeader('Authorization', "Bearer {$token}")->getJson("/api/projects/{$projectId}/summary");
        $summary->assertStatus(200);
        $summary->assertJson([
            'revenue' => 0,
            'cost' => 0,
            'profit' => 0,
            'budget_amount' => 100000,
            'budget_used_pct' => 0.0,
            'open_belege_count' => 0,
        ]);
    }

    public function test_customer_project_can_be_created_with_contact(): void
    {
        $token = $this->ownerToken();

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/projects', [
            'name' => 'Kundenprojekt',
            'contact_id' => $this->data->customer->id,
        ]);
        $response->assertStatus(201);
        $response->assertJsonPath('contact_id', $this->data->customer->id);
    }

    // -----------------------------------------------------------------
    // Kosten-Nachweis (costReport) - Storno-Neutralisierung
    // -----------------------------------------------------------------

    public function test_cost_report_sums_correctly_with_storno_neutralization(): void
    {
        $token = $this->ownerToken();

        $projectResponse = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/projects', [
            'name' => 'Kosten-Nachweis-Projekt',
            'contact_id' => $this->data->customer->id,
        ]);
        $projectResponse->assertStatus(201);
        $projectId = $projectResponse->json('id');
        $costObjectId = $projectResponse->json('cost_object_id');

        // Buchung 1: bleibt festgeschrieben (posted).
        $booking1 = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/bookings', [
            'date' => now()->subDays(2)->toDateString(),
            'description' => 'Materialkosten Projekt',
            'lines' => [
                ['account_id' => $this->data->accountExpense->id, 'type' => 'debit', 'amount' => 5000, 'tax_amount' => 950, 'cost_object_id' => $costObjectId],
                ['account_id' => $this->data->accountTax->id, 'type' => 'debit', 'amount' => 950],
                ['account_id' => $this->data->accountBank->id, 'type' => 'credit', 'amount' => 5950],
            ],
        ]);
        $booking1->assertStatus(201);
        $this->withHeader('Authorization', "Bearer {$token}")->postJson("/api/bookings/{$booking1->json('id')}/lock")->assertStatus(200);

        // Buchung 2: wird festgeschrieben UND anschließend storniert - muss sich
        // in der Summe zu 0 neutralisieren (Reports-Prinzip).
        $booking2 = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/bookings', [
            'date' => now()->subDays(1)->toDateString(),
            'description' => 'Fehlbuchung Projekt (wird storniert)',
            'lines' => [
                ['account_id' => $this->data->accountExpense->id, 'type' => 'debit', 'amount' => 3000, 'tax_amount' => 570, 'cost_object_id' => $costObjectId],
                ['account_id' => $this->data->accountTax->id, 'type' => 'debit', 'amount' => 570],
                ['account_id' => $this->data->accountBank->id, 'type' => 'credit', 'amount' => 3570],
            ],
        ]);
        $booking2->assertStatus(201);
        $this->withHeader('Authorization', "Bearer {$token}")->postJson("/api/bookings/{$booking2->json('id')}/lock")->assertStatus(200);
        $this->withHeader('Authorization', "Bearer {$token}")->postJson("/api/bookings/{$booking2->json('id')}/reverse")->assertStatus(201);

        $costReport = $this->withHeader('Authorization', "Bearer {$token}")->getJson("/api/projects/{$projectId}/cost-report");
        $costReport->assertStatus(200);

        // 3 Zeilen: Buchung 1 (posted) + Buchung 2 (cancelled) + Storno-Gegenbuchung (posted).
        $this->assertCount(3, $costReport->json('lines'));

        $this->assertSame(5000, $costReport->json('totals.netto'), 'Nur Buchung 1 darf in der Netto-Summe übrig bleiben (Storno-Paar neutralisiert sich).');
        $this->assertSame(950, $costReport->json('totals.ust'));
        $this->assertSame(5950, $costReport->json('totals.brutto'));
    }

    // -----------------------------------------------------------------
    // Löschschutz (aktiv statt löschen)
    // -----------------------------------------------------------------

    public function test_cost_center_with_bookings_cannot_be_deleted(): void
    {
        $token = $this->ownerToken();

        $costCenter = CostCenter::create(['code' => 'CC-USED', 'name' => 'Verwendete Kostenstelle', 'active' => true]);

        $booking = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/bookings', [
            'date' => now()->toDateString(),
            'description' => 'Buchung mit Kostenstelle',
            'lines' => [
                ['account_id' => $this->data->accountExpense->id, 'type' => 'debit', 'amount' => 1000, 'cost_center_id' => $costCenter->id],
                ['account_id' => $this->data->accountBank->id, 'type' => 'credit', 'amount' => 1000],
            ],
        ]);
        $booking->assertStatus(201);

        $response = $this->withHeader('Authorization', "Bearer {$token}")->deleteJson("/api/cost-centers/{$costCenter->id}");
        $response->assertStatus(422);

        $this->assertNotNull(CostCenter::find($costCenter->id), 'Kostenstelle darf nicht gelöscht worden sein.');
    }

    public function test_project_with_bookings_cannot_be_deleted(): void
    {
        $token = $this->ownerToken();

        $projectResponse = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/projects', [
            'name' => 'Projekt mit Buchung',
            'contact_id' => $this->data->customer->id,
        ]);
        $projectId = $projectResponse->json('id');
        $costObjectId = $projectResponse->json('cost_object_id');

        $booking = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/bookings', [
            'date' => now()->toDateString(),
            'description' => 'Buchung für Projekt',
            'lines' => [
                ['account_id' => $this->data->accountExpense->id, 'type' => 'debit', 'amount' => 1000, 'cost_object_id' => $costObjectId],
                ['account_id' => $this->data->accountBank->id, 'type' => 'credit', 'amount' => 1000],
            ],
        ]);
        $booking->assertStatus(201);

        $response = $this->withHeader('Authorization', "Bearer {$token}")->deleteJson("/api/projects/{$projectId}");
        $response->assertStatus(422);

        $this->assertNotNull(Project::find($projectId));
    }

    public function test_project_without_bookings_can_be_deleted(): void
    {
        $token = $this->ownerToken();

        $projectResponse = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/projects', [
            'name' => 'Leeres Projekt',
        ]);
        $projectId = $projectResponse->json('id');
        $costObjectId = $projectResponse->json('cost_object_id');

        $response = $this->withHeader('Authorization', "Bearer {$token}")->deleteJson("/api/projects/{$projectId}");
        $response->assertStatus(200);

        $this->assertNull(Project::find($projectId));
        $this->assertNull(CostObject::find($costObjectId), 'Der dedizierte Kostenträger muss mit dem Projekt gelöscht werden.');
    }

    // -----------------------------------------------------------------
    // Rollen
    // -----------------------------------------------------------------

    public function test_cachier_gets_403_on_project_write_routes(): void
    {
        $cachier = User::create([
            'name' => 'Kassierer',
            'email' => 'cachier@spec08.test',
            'password' => bcrypt('password'),
            'tenant_id' => $this->data->tenant->id,
        ]);
        $cachier->assignRole(Role::firstOrCreate(['name' => 'cachier', 'guard_name' => 'api']));
        $token = $this->tokenFor($cachier);

        $response = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/projects', [
            'name' => 'Verbotenes Projekt',
        ]);
        $response->assertStatus(403);
    }

    public function test_cachier_can_still_read_projects(): void
    {
        $token = $this->ownerToken();
        $projectResponse = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/projects', ['name' => 'Lesbares Projekt']);
        $projectResponse->assertStatus(201);

        $cachier = User::create([
            'name' => 'Kassierer 2',
            'email' => 'cachier2@spec08.test',
            'password' => bcrypt('password'),
            'tenant_id' => $this->data->tenant->id,
        ]);
        $cachier->assignRole(Role::firstOrCreate(['name' => 'cachier', 'guard_name' => 'api']));
        $cachierToken = $this->tokenFor($cachier);

        $response = $this->withHeader('Authorization', "Bearer {$cachierToken}")->getJson('/api/projects');
        $response->assertStatus(200);
    }

    // -----------------------------------------------------------------
    // Tenant-Isolation
    // -----------------------------------------------------------------

    public function test_tenant_isolation_for_cost_centers_cost_objects_and_projects(): void
    {
        // Tenant-A-Ressourcen direkt per Model anlegen (Kontext ist A aus setUp).
        // Bewusst KEIN HTTP als A: jwt-auth cached im Test den einmal aufgelösten
        // Token/User über HTTP-Calls hinweg (in echtem HTTP kein Problem, da jeder
        // Request ein eigener Prozess ist). Würde man hier erst als A per HTTP
        // anlegen und dann als B lesen, sähe der B-Request den gecachten User A.
        $costCenterA = CostCenter::create(['code' => 'CC-A', 'name' => 'Kostenstelle A']);
        $costObjectA = CostObject::create(['code' => 'CO-A', 'name' => 'Kostenträger A']);
        $projectCostObjectA = CostObject::create(['code' => 'KT-PRJ-A', 'name' => 'Projekt A']);
        $projectA = Project::create([
            'number' => 'PRJ-ISO-A',
            'name' => 'Projekt A',
            'cost_object_id' => $projectCostObjectA->id,
        ]);

        // Tenant B anlegen (wechselt currentTenant + Auth auf B).
        $dataB = TenantTestDataFactory::create('spec08b');

        // Lesen als B (actingAs setzt den User deterministisch pro Request,
        // ohne Token-Parsing) → nichts von Tenant A sichtbar.
        $this->actingAs($dataB->user, 'api')->getJson("/api/cost-centers/{$costCenterA->id}")->assertStatus(404);
        $this->actingAs($dataB->user, 'api')->getJson("/api/cost-objects/{$costObjectA->id}")->assertStatus(404);
        $this->actingAs($dataB->user, 'api')->getJson("/api/projects/{$projectA->id}")->assertStatus(404);

        // Listen sind ebenfalls getrennt.
        $listB = $this->actingAs($dataB->user, 'api')->getJson('/api/projects');
        $listB->assertStatus(200);
        $ids = collect($listB->json())->pluck('id');
        $this->assertNotContains($projectA->id, $ids);
    }

    // -----------------------------------------------------------------
    // Teil B: Kosten-Nachweis-PDF
    // -----------------------------------------------------------------

    public function test_cost_report_pdf_renders_and_contains_no_revenue(): void
    {
        $token = $this->ownerToken();

        $projectResponse = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/projects', [
            'name' => 'PDF-Projekt', 'contact_id' => $this->data->customer->id,
        ]);
        $costObjectId = $projectResponse->json('cost_object_id');
        $projectId = $projectResponse->json('id');

        // Eine Kostenbuchung (Aufwand + Vorsteuer an Bank) auf das Projekt.
        $booking = $this->withHeader('Authorization', "Bearer {$token}")->postJson('/api/bookings', [
            'date' => now()->toDateString(),
            'description' => 'Geheime Beratungskosten',
            'lines' => [
                ['account_id' => $this->data->accountExpense->id, 'type' => 'debit', 'amount' => 10000, 'tax_amount' => 1900, 'cost_object_id' => $costObjectId],
                ['account_id' => $this->data->accountTax->id, 'type' => 'debit', 'amount' => 1900],
                ['account_id' => $this->data->accountBank->id, 'type' => 'credit', 'amount' => 11900],
            ],
        ]);
        $this->withHeader('Authorization', "Bearer {$token}")->postJson("/api/bookings/{$booking->json('id')}/lock")->assertStatus(200);

        $pdf = $this->withHeader('Authorization', "Bearer {$token}")->get("/api/projects/{$projectId}/cost-report/pdf");
        $pdf->assertStatus(200);
        $this->assertSame('application/pdf', $pdf->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $pdf->getContent());
    }
}
