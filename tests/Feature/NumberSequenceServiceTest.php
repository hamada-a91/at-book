<?php

namespace Tests\Feature;

use App\Models\CompanySetting;
use App\Models\Tenant;
use App\Models\User;
use App\Services\NumberSequenceService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * SPEC-05 (Teil A): NumberSequenceService - Akzeptanzkriterien.
 */
class NumberSequenceServiceTest extends TestCase
{
    use RefreshDatabase;

    private function makeTenant(string $slug): Tenant
    {
        $tenant = Tenant::create(['name' => "Seq Test {$slug}", 'slug' => "seq-test-{$slug}"]);
        User::create([
            'name' => 'Owner',
            'email' => "owner-{$slug}@seq.test",
            'password' => bcrypt('password'),
            'tenant_id' => $tenant->id,
        ]);

        // BelongsToTenant setzt tenant_id nur automatisch, wenn currentTenant zum
        // Erstellzeitpunkt bereits gebunden ist - hier kurz umschalten, damit
        // CompanySetting::create() die NOT-NULL-Spalte tenant_id korrekt befüllt.
        app()->instance('currentTenant', $tenant);
        CompanySetting::create(['company_name' => "Seq Test {$slug}", 'onboarding_completed' => true]);

        return $tenant;
    }

    /**
     * Paralleltest als sequentielle Simulation (siehe Spec-Akzeptanzkriterium):
     * 20 nacheinander gezogene Nummern müssen fortlaufend und eindeutig sein.
     * Der Unique-Constraint-Nachweis folgt in der zweiten Testmethode.
     */
    public function test_sequential_numbers_are_gapless_and_unique(): void
    {
        $tenant = $this->makeTenant('seq1');
        app()->instance('currentTenant', $tenant);

        $service = new NumberSequenceService;
        $numbers = [];
        for ($i = 0; $i < 20; $i++) {
            $numbers[] = DB::transaction(fn () => $service->next('invoice'));
        }

        $year = date('Y');
        $expected = array_map(fn ($n) => sprintf('RE-%s-%04d', $year, $n), range(1, 20));
        $this->assertSame($expected, $numbers);
        $this->assertCount(20, array_unique($numbers), 'Alle 20 Nummern müssen eindeutig sein.');
    }

    /**
     * Unique-Constraint-Nachweis: (tenant_id, type, year) verhindert doppelte
     * Sequenz-Zeilen auf DB-Ebene - die Grundlage für die Race-Freiheit von
     * NumberSequenceService::next() (siehe lockedSequence()/SAVEPOINT-Kommentar
     * dort).
     */
    public function test_unique_constraint_prevents_duplicate_sequence_rows(): void
    {
        $tenant = $this->makeTenant('seq2');

        DB::table('number_sequences')->insert([
            'public_id' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'type' => 'invoice',
            'year' => (int) date('Y'),
            'last_number' => 0,
            'format' => 'RE-{YYYY}-{NNNN}',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->expectException(QueryException::class);

        DB::table('number_sequences')->insert([
            'public_id' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'type' => 'invoice',
            'year' => (int) date('Y'),
            'last_number' => 0,
            'format' => 'RE-{YYYY}-{NNNN}',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_two_tenants_have_independent_sequences(): void
    {
        $tenantA = $this->makeTenant('tenA');
        $tenantB = $this->makeTenant('tenB');

        $service = new NumberSequenceService;

        app()->instance('currentTenant', $tenantA);
        $numberA = DB::transaction(fn () => $service->next('invoice'));

        app()->instance('currentTenant', $tenantB);
        $numberB = DB::transaction(fn () => $service->next('invoice'));

        $year = date('Y');
        $this->assertSame(sprintf('RE-%s-0001', $year), $numberA);
        $this->assertSame(sprintf('RE-%s-0001', $year), $numberB, 'Tenant B muss unabhängig vom Verbrauch von Tenant A bei 0001 starten.');
    }

    public function test_year_rollover_starts_new_sequence_at_one(): void
    {
        $tenant = $this->makeTenant('yr');
        app()->instance('currentTenant', $tenant);
        $service = new NumberSequenceService;

        $thisYear = (int) date('Y');
        // Zwei Nummern im laufenden Jahr ziehen ...
        DB::transaction(fn () => $service->next('invoice', $thisYear));
        $numberThisYear = DB::transaction(fn () => $service->next('invoice', $thisYear));
        // ... dann der Jahreswechsel: neuer, unabhängiger Kreis ab 0001.
        $numberNextYear = DB::transaction(fn () => $service->next('invoice', $thisYear + 1));

        $this->assertSame(sprintf('RE-%d-0002', $thisYear), $numberThisYear);
        $this->assertSame(sprintf('RE-%d-0001', $thisYear + 1), $numberNextYear);
    }

    /**
     * journal-Kreis ist jahresunabhängig (year=0, siehe Spec Teil A) und nutzt ein
     * eigenes, 6-stelliges Format ({NNNNNN}) statt der 4-stelligen Dokumentnummern.
     */
    public function test_journal_sequence_is_year_independent_and_gapless(): void
    {
        $tenant = $this->makeTenant('journal');
        app()->instance('currentTenant', $tenant);
        $service = new NumberSequenceService;

        $first = DB::transaction(fn () => $service->next('journal', 0));
        $second = DB::transaction(fn () => $service->next('journal', 0));

        $this->assertSame('J-000001', $first);
        $this->assertSame('J-000002', $second);
    }

    public function test_next_without_tenant_context_throws(): void
    {
        app()->forgetInstance('currentTenant');
        $service = new NumberSequenceService;

        $this->expectException(\DomainException::class);

        DB::transaction(fn () => $service->next('invoice'));
    }
}
