<?php

namespace Tests\Feature\Backup;

use App\Models\CompanySetting;
use App\Models\Invoice;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Contacts\Models\Contact;
use App\Services\NumberSequenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\BackupTestHelper;
use Tests\TestCase;

/**
 * SPEC-05 (Teil A, Backup-Impact Punkt 1): number_sequences wird bewusst NICHT
 * exportiert (siehe EntityTransformerRegistry - kein Eintrag, und
 * BackupRoundtripTest::REGISTRY_EXCEPTIONS). Stattdessen rekonstruiert
 * BackupImportService::reconstructNumberSequences() last_number je Typ/Jahr
 * NACH dem Import direkt aus den importierten Dokumentnummern. Dieser Test
 * beweist konkret: nach einem Import erhält die nächste über
 * NumberSequenceService angeforderte Nummer keinen Duplikat-Wert, sondern
 * schließt nahtlos an den importierten Bestand an - obwohl Tenant A selbst
 * NIE einen number_sequences-Datensatz hatte (die Rechnungen wurden mit
 * fest verdrahteten Nummern angelegt, nicht über den Service - genau das
 * Szenario eines Alt-Backups von vor SPEC-05).
 */
class NumberSequenceReconstructionTest extends TestCase
{
    use RefreshDatabase;

    public function test_next_invoice_number_continues_seamlessly_after_import(): void
    {
        $tenantA = Tenant::create(['name' => 'Sequence Reconstruct A', 'slug' => 'seq-recon-a']);
        $userA = User::create([
            'name' => 'Owner A',
            'email' => 'owner-a@seq-recon.test',
            'password' => Hash::make('password'),
            'tenant_id' => $tenantA->id,
        ]);

        app()->instance('currentTenant', $tenantA);
        Auth::setUser($userA);

        CompanySetting::create([
            'company_name' => 'Sequence Reconstruct A',
            'onboarding_completed' => true,
        ]);

        $customerAccount = Account::create(['code' => '10001', 'name' => 'Debitor', 'type' => 'asset']);
        $revenueAccount = Account::create(['code' => '8400', 'name' => 'Erlöse', 'type' => 'revenue']);
        $customer = Contact::create([
            'name' => 'Testkunde',
            'type' => 'customer',
            'customer_account_id' => $customerAccount->id,
        ]);

        $year = (int) date('Y');

        // Zwei "echte" Rechnungen im produktionsnahen Format (RE-JJJJ-NNNN) - bewusst
        // NICHT über NumberSequenceService erzeugt (kein number_sequences-Datensatz
        // für Tenant A), um die Rekonstruktion rein aus dem Datenbestand zu beweisen.
        foreach (["RE-{$year}-0001", "RE-{$year}-0002"] as $number) {
            $invoice = Invoice::create([
                'invoice_number' => $number,
                'contact_id' => $customer->id,
                'invoice_date' => now()->toDateString(),
                'due_date' => now()->addDays(14)->toDateString(),
                'status' => 'draft',
                'subtotal' => 10000,
                'tax_total' => 1900,
                'total' => 11900,
            ]);
            $invoice->lines()->create([
                'description' => 'Testposition',
                'quantity' => 1,
                'unit' => 'Stück',
                'unit_price' => 10000,
                'tax_rate' => 19,
                'line_total' => 10000,
                'account_id' => $revenueAccount->id,
            ]);
        }

        $this->assertSame(
            0,
            DB::table('number_sequences')->where('tenant_id', $tenantA->id)->count(),
            'Sanity: kein Sequence-Datensatz vorhanden - Rekonstruktion muss rein aus den Dokumenten erfolgen.'
        );

        $export = BackupTestHelper::exportToArray($tenantA, $userA);

        $tenantB = Tenant::create(['name' => 'Sequence Reconstruct B', 'slug' => 'seq-recon-b']);
        $userB = User::create([
            'name' => 'Owner B',
            'email' => 'owner-b@seq-recon.test',
            'password' => Hash::make('password'),
            'tenant_id' => $tenantB->id,
        ]);

        app()->instance('currentTenant', $tenantB);
        Auth::setUser($userB);

        BackupTestHelper::importZip($export['zip_path'], $tenantB, $userB);

        // Nach dem Import: number_sequences für Tenant B muss last_number=2 haben
        // (aus RE-JJJJ-0001/0002 rekonstruiert).
        $sequence = DB::table('number_sequences')
            ->where('tenant_id', $tenantB->id)
            ->where('type', 'invoice')
            ->where('year', $year)
            ->first();

        $this->assertNotNull($sequence, 'Rekonstruktion muss einen number_sequences-Datensatz für Tenant B angelegt haben.');
        $this->assertSame(2, $sequence->last_number);

        // Die nächste über den Service angeforderte Nummer muss nahtlos anschließen
        // (next() MUSS innerhalb einer Transaktion laufen, siehe NumberSequenceService).
        $nextNumber = DB::transaction(fn () => app(NumberSequenceService::class)->next('invoice'));

        $this->assertSame("RE-{$year}-0003", $nextNumber);

        // Sanity: die importierten Rechnungen sind tatsächlich da (die neue Nummer
        // RE-JJJJ-0003 oben dupliziert also keine von ihnen).
        $this->assertDatabaseHas('invoices', [
            'tenant_id' => $tenantB->id,
            'invoice_number' => "RE-{$year}-0001",
        ]);
        $this->assertDatabaseHas('invoices', [
            'tenant_id' => $tenantB->id,
            'invoice_number' => "RE-{$year}-0002",
        ]);
    }

    public function test_reconstruction_never_decreases_an_existing_sequence(): void
    {
        // Reimport (z.B. Wiederherstellung eines älteren Backups in einen bereits
        // genutzten Tenant) darf last_number NIE zurückdrehen - sonst könnten künftig
        // vergebene Nummern mit bereits existierenden (neueren) Dokumenten kollidieren.
        $tenant = Tenant::create(['name' => 'Sequence No Decrease', 'slug' => 'seq-no-decrease']);
        $user = User::create([
            'name' => 'Owner',
            'email' => 'owner@seq-no-decrease.test',
            'password' => Hash::make('password'),
            'tenant_id' => $tenant->id,
        ]);

        app()->instance('currentTenant', $tenant);
        Auth::setUser($user);

        CompanySetting::create(['company_name' => 'Sequence No Decrease', 'onboarding_completed' => true]);

        $year = (int) date('Y');

        DB::table('number_sequences')->insert([
            'public_id' => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $tenant->id,
            'type' => 'invoice',
            'year' => $year,
            'last_number' => 10,
            'format' => 'RE-{YYYY}-{NNNN}',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $customerAccount = Account::create(['code' => '10001', 'name' => 'Debitor', 'type' => 'asset']);
        $customer = Contact::create([
            'name' => 'Testkunde',
            'type' => 'customer',
            'customer_account_id' => $customerAccount->id,
        ]);

        Invoice::create([
            'invoice_number' => "RE-{$year}-0002",
            'contact_id' => $customer->id,
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(14)->toDateString(),
            'status' => 'draft',
            'subtotal' => 10000,
            'tax_total' => 1900,
            'total' => 11900,
        ]);

        $export = BackupTestHelper::exportToArray($tenant, $user);
        BackupTestHelper::importZip($export['zip_path'], $tenant, $user);

        $sequence = DB::table('number_sequences')
            ->where('tenant_id', $tenant->id)
            ->where('type', 'invoice')
            ->where('year', $year)
            ->first();

        $this->assertSame(10, $sequence->last_number, 'Reimport mit niedrigerer Höchstnummer darf last_number nicht zurückdrehen.');
    }
}
