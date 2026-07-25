<?php

namespace Tests\Feature\Backup;

use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\JournalEntryLine;
use App\Modules\Contacts\Models\Contact;
use App\Modules\Projects\Models\CostCenter;
use App\Modules\Projects\Models\CostObject;
use App\Modules\Projects\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tests\Support\BackupTestHelper;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

/**
 * SPEC-08 (Teil A), Backup-Impact: Projekt + Kostenstelle/Kostenträger +
 * dimensionierte Buchung müssen den Export/Import-Roundtrip überstehen,
 * inklusive eines INTERNEN Projekts (contact_id null).
 *
 * Die generelle Zähler-Gleichheit (cost_centers/cost_objects/projects A vs.
 * B) ist bereits über BackupRoundtripTest::test_roundtrip_preserves_entity_counts_and_relations
 * abgedeckt (iteriert automatisch über ALLE Registry-Entity-Typen). Dieser
 * Test prüft zusätzlich gezielt die FACHLICHE Verknüpfung (public_id-Remapping)
 * und den Sonderfall "internes Projekt ohne Kunde".
 */
class ProjectBackupRoundtripTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        \Illuminate\Database\Eloquent\Model::reguard();
        parent::tearDown();
    }

    public function test_project_with_dimensioned_booking_and_internal_project_survive_roundtrip(): void
    {
        $dataA = TenantTestDataFactory::create('prjbkp');

        // Zusätzliches INTERNES Projekt (kein Kunde) - die Factory legt bereits ein
        // Kundenprojekt an (dataA->project), hier gezielt der Sonderfall contact_id=null.
        $internalCostObject = CostObject::create([
            'code' => 'CO-INTERNAL-'.uniqid(),
            'name' => 'BieneB',
            'active' => true,
        ]);
        $internalProject = Project::create([
            'number' => 'PRJ-TEST-INTERNAL-'.uniqid(),
            'name' => 'BieneB',
            'contact_id' => null,
            'cost_object_id' => $internalCostObject->id,
            'budget_amount' => 123400,
            'status' => 'active',
        ]);

        $export = BackupTestHelper::exportToArray($dataA->tenant, $dataA->user);

        $tenantB = Tenant::create(['name' => 'Projekt-Backup Ziel-Tenant', 'slug' => 'projekt-backup-ziel-'.uniqid()]);
        $userB = User::create([
            'name' => 'Projekt-Backup Importeur',
            'email' => 'projekt-backup-'.uniqid().'@at-book.test',
            'password' => Hash::make('password'),
            'tenant_id' => $tenantB->id,
        ]);

        app()->instance('currentTenant', $tenantB);
        Auth::setUser($userB);
        BackupTestHelper::importZip($export['zip_path'], $tenantB, $userB);

        app()->instance('currentTenant', $tenantB);

        // ---- Kundenprojekt (aus der Factory) ----
        $customerProjectB = Project::withoutGlobalScopes()
            ->where('tenant_id', $tenantB->id)
            ->where('number', $dataA->project->number)
            ->first();
        $this->assertNotNull($customerProjectB, 'Kundenprojekt muss den Roundtrip überstehen.');
        $this->assertSame($dataA->project->name, $customerProjectB->name);
        $this->assertSame((int) $dataA->project->budget_amount, (int) $customerProjectB->budget_amount);
        $this->assertNotNull($customerProjectB->contact_id, 'Kundenprojekt muss weiterhin einen Kontakt haben.');

        $contactB = Contact::withoutGlobalScopes()->find($customerProjectB->contact_id);
        $this->assertNotNull($contactB);
        $this->assertSame($dataA->customer->email, $contactB->email, 'Projekt->Kontakt muss auf den korrekt remappten Kontakt zeigen.');

        $costObjectB = CostObject::withoutGlobalScopes()->find($customerProjectB->cost_object_id);
        $this->assertNotNull($costObjectB);
        $this->assertSame($dataA->projectCostObject->code, $costObjectB->code, 'Projekt->Kostenträger muss auf den korrekt remappten Kostenträger (gleicher Code) zeigen.');

        // ---- Internes Projekt (contact_id null) ----
        $internalProjectB = Project::withoutGlobalScopes()
            ->where('tenant_id', $tenantB->id)
            ->where('number', $internalProject->number)
            ->first();
        $this->assertNotNull($internalProjectB, 'Internes Projekt muss den Roundtrip überstehen.');
        $this->assertNull($internalProjectB->contact_id, 'Internes Projekt bleibt ohne Kontakt (contact_id null).');
        $this->assertSame('BieneB', $internalProjectB->name);

        // ---- Dimensionierte Buchung (Kostenstelle + Kostenträger) ----
        $dimensionedLineB = JournalEntryLine::withoutGlobalScopes()
            ->whereHas('journalEntry', fn ($q) => $q->where('tenant_id', $tenantB->id)->where('description', $dataA->journalProjectCost->description))
            ->whereNotNull('cost_center_id')
            ->first();
        $this->assertNotNull($dimensionedLineB, 'Dimensionierte Journalzeile (cost_center_id) muss den Roundtrip überstehen.');
        $this->assertSame(10000, (int) $dimensionedLineB->amount);
        $this->assertSame(1900, (int) $dimensionedLineB->tax_amount);

        $costCenterB = CostCenter::withoutGlobalScopes()->find($dimensionedLineB->cost_center_id);
        $this->assertNotNull($costCenterB);
        $this->assertSame($dataA->costCenter->code, $costCenterB->code, 'Journalzeile->Kostenstelle muss auf die korrekt remappte Kostenstelle (gleicher Code) zeigen.');

        $lineCostObjectB = CostObject::withoutGlobalScopes()->find($dimensionedLineB->cost_object_id);
        $this->assertNotNull($lineCostObjectB);
        $this->assertSame($dataA->projectCostObject->code, $lineCostObjectB->code, 'Journalzeile->Kostenträger muss auf den korrekt remappten Kostenträger (gleicher Code, = Projekt-Kostenträger) zeigen.');
    }
}
