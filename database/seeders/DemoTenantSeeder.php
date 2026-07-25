<?php

namespace Database\Seeders;

use App\Models\BankAccount;
use App\Models\Beleg;
use App\Models\CompanySetting;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Services\BookingService;
use App\Modules\Contacts\Models\Contact;
use App\Modules\Projects\Models\CostCenter;
use App\Modules\Projects\Models\CostObject;
use App\Modules\Projects\Models\Project;
use App\Services\InventoryService;
use App\Services\NumberSequenceService;
use App\Services\Skr03AccountPlanGenerator;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Legt einen vollständigen Demo-Tenant zum Testen an.
 *
 * Login: demo@at-book.local / password (Rolle: owner)
 *
 * Enthält: Firmeneinstellungen (Onboarding abgeschlossen), SKR03-Kontenplan,
 * Kontakte (Kunde + Lieferant mit Debitoren-/Kreditorenkonto), Produkte mit
 * Lagerbestand, Bankkonto, Rechnungs-Drafts sowie Journalbuchungen in allen
 * Status (draft / festgeschrieben / storniert).
 *
 * Nur für lokale Umgebungen gedacht. Idempotent: bricht ab, wenn der
 * Demo-Tenant bereits existiert.
 */
class DemoTenantSeeder extends Seeder
{
    private const TENANT_SLUG = 'demo-firma';

    private const DEMO_EMAIL = 'demo@at-book.local';

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command->error('DemoTenantSeeder ist nicht für Produktion gedacht – abgebrochen.');

            return;
        }

        if (Tenant::where('slug', self::TENANT_SLUG)->exists()) {
            $this->command->info('ℹ️  Demo-Tenant existiert bereits – nichts zu tun.');
            $this->command->line('   Login: '.self::DEMO_EMAIL.' / password');

            return;
        }

        // Alles-oder-nichts: kein halber Demo-Tenant bei Fehlern
        DB::transaction(fn () => $this->seedDemoData());
    }

    private function seedDemoData(): void
    {
        // 1. Tenant + Owner
        $tenant = Tenant::create([
            'name' => 'Demo Firma GmbH',
            'slug' => self::TENANT_SLUG,
        ]);

        $owner = User::create([
            'name' => 'Demo Benutzer',
            'email' => self::DEMO_EMAIL,
            'password' => Hash::make('password'),
            'tenant_id' => $tenant->id,
        ]);
        $owner->assignRole(\Spatie\Permission\Models\Role::firstOrCreate(['name' => 'owner', 'guard_name' => 'api']));

        // Tenant-Kontext + Auth setzen: Global Scopes und BookingService
        // (Auth::id() für user_id) brauchen beides außerhalb von HTTP-Requests.
        app()->instance('currentTenant', $tenant);
        Auth::setUser($owner);

        // 2. Firmeneinstellungen (Onboarding abgeschlossen → Fach-Routen offen)
        $settings = CompanySetting::create([
            'company_name' => 'Demo Firma GmbH',
            'street' => 'Musterstraße 123',
            'zip' => '10115',
            'city' => 'Berlin',
            'country' => 'Deutschland',
            'email' => 'info@demo-firma.de',
            'phone' => '+49 30 12345678',
            'tax_number' => 'DE123456789',
            'tax_type' => 'umsatzsteuer_pflichtig',
            'business_models' => json_encode(['dienstleistungen', 'handel']),
            'legal_form' => 'gmbh',
            'account_plan_initialized_at' => now(),
            'onboarding_completed' => true,
        ]);
        $settings->module_inventory_enabled = true; // nicht im $fillable
        // SPEC-08 (Teil A): Projekte/Kostenstellen im Demo-Tenant aktiviert, damit
        // das Feature (nach Teil B: Frontend) direkt sichtbar/nutzbar ist.
        $settings->module_projects_enabled = true;
        $settings->module_cost_centers_enabled = true;
        $settings->save();

        // 3. SKR03-Kontenplan
        $generator = new Skr03AccountPlanGenerator;
        foreach ($generator->generateAccounts(['dienstleistungen', 'handel'], 'gmbh') as $accountData) {
            if (! Account::where('code', $accountData['code'])->exists()) {
                Account::create($accountData);
            }
        }
        $this->command->info('✅ Kontenplan: '.Account::count().' Konten');

        $bank = $this->account('1200', 'asset');      // Bank
        $revenue = $this->account('8400', 'revenue');  // Erlöse 19%
        $expense = $this->account('4930', 'expense');  // Bürobedarf o.ä.

        // 4. Kontakte mit Personenkonten
        $debitorAccount = Account::create([
            'code' => '10001', 'name' => 'Debitor: Muster GmbH', 'type' => 'asset', 'category' => 'Debitoren',
        ]);
        $kunde = Contact::create([
            'name' => 'Muster GmbH', 'type' => 'customer', 'email' => 'einkauf@muster-gmbh.de',
            'address' => "Kundenweg 1\n80331 München", 'customer_account_id' => $debitorAccount->id,
        ]);

        $kreditorAccount = Account::create([
            'code' => '70001', 'name' => 'Kreditor: Bürobedarf Schmidt KG', 'type' => 'liability', 'category' => 'Kreditoren',
        ]);
        $lieferant = Contact::create([
            'name' => 'Bürobedarf Schmidt KG', 'type' => 'vendor', 'email' => 'verkauf@schmidt-kg.de',
            'address' => "Lieferantenallee 9\n50667 Köln", 'vendor_account_id' => $kreditorAccount->id,
        ]);

        // 5. Produkte + Lagerbestand
        $kategorie = ProductCategory::create(['name' => 'IT & Hardware']);
        $laptop = Product::create([
            'type' => 'goods', 'name' => 'Business Laptop 15"', 'article_number' => 'HW-0001',
            'unit' => 'Stück', 'price_net' => 89900, 'price_gross' => 106981, 'tax_rate' => 19,
            'track_stock' => true, 'stock_quantity' => 0, 'reorder_level' => 3,
            'account_id' => $revenue->id, 'category_id' => $kategorie->id,
        ]);
        Product::create([
            'type' => 'service', 'name' => 'IT-Beratung', 'article_number' => 'DL-0001',
            'unit' => 'Stunde', 'price_net' => 12000, 'price_gross' => 14280, 'tax_rate' => 19,
            'track_stock' => false, 'account_id' => $revenue->id, 'category_id' => $kategorie->id,
        ]);
        (new InventoryService)->addStock($laptop, 10, 'purchase', 'Anfangsbestand (Demo-Daten)');

        // 6. Bankkonto
        BankAccount::create([
            'name' => 'Geschäftskonto', 'bank_name' => 'Demo Bank AG',
            'iban' => 'DE02120300000000202051', 'bic' => 'BYLADEM1001',
            'currency' => 'EUR', 'is_default' => true, 'account_id' => $bank->id,
        ]);

        // 7. Journalbuchungen in allen Status (über den BookingService!)
        $bookingService = new BookingService;

        // Draft (offen, änderbar)
        $bookingService->createBooking([
            'date' => now()->subDays(3)->toDateString(),
            'description' => 'Büromaterial (Entwurf)',
            'contact_id' => $lieferant->id,
            'lines' => [
                ['account_id' => $expense->id, 'type' => 'debit', 'amount' => 5950],
                ['account_id' => $bank->id, 'type' => 'credit', 'amount' => 5950],
            ],
        ]);

        // Festgeschrieben (GoBD-gelockt)
        $posted = $bookingService->createBooking([
            'date' => now()->subDays(10)->toDateString(),
            'description' => 'Barverkauf Dienstleistung',
            'contact_id' => $kunde->id,
            'lines' => [
                ['account_id' => $bank->id, 'type' => 'debit', 'amount' => 119000],
                ['account_id' => $revenue->id, 'type' => 'credit', 'amount' => 119000],
            ],
        ]);
        $bookingService->lockBooking($posted->id);

        // Festgeschrieben + storniert (Generalumkehr)
        $storniert = $bookingService->createBooking([
            'date' => now()->subDays(7)->toDateString(),
            'description' => 'Fehlbuchung (wird storniert)',
            'lines' => [
                ['account_id' => $expense->id, 'type' => 'debit', 'amount' => 25000],
                ['account_id' => $bank->id, 'type' => 'credit', 'amount' => 25000],
            ],
        ]);
        $bookingService->lockBooking($storniert->id);
        $bookingService->reverseBooking($storniert->id);

        // 8. Rechnungs-Drafts (zum Testen von Buchen/PDF/Versand über die UI).
        // SPEC-05 (Teil A): Nummern über NumberSequenceService statt fest verdrahtet
        // (RE-JJJJ-0001/0002) - sonst würde die erste über die UI erstellte Rechnung
        // (die den Sequence-Service nutzt) mit RE-JJJJ-0001 kollidieren, weil die
        // Sequenz-Tabelle zum Migrationszeitpunkt noch leer war (keine Bestandsdaten).
        $numberSequenceService = new NumberSequenceService;
        $this->createDraftInvoice($numberSequenceService->next('invoice'), $kunde->id, $revenue->id, [
            ['description' => 'IT-Beratung Juni', 'quantity' => 8, 'unit' => 'Stunde', 'unit_price' => 12000],
        ]);
        $this->createDraftInvoice($numberSequenceService->next('invoice'), $kunde->id, $revenue->id, [
            ['description' => 'Business Laptop 15"', 'quantity' => 2, 'unit' => 'Stück', 'unit_price' => 89900, 'product_id' => $laptop->id],
            ['description' => 'Einrichtung vor Ort', 'quantity' => 3, 'unit' => 'Stunde', 'unit_price' => 12000],
        ]);

        // 9. Eingangsbeleg (offen, zum Testen des Beleg-Workflows)
        Beleg::create([
            'document_number' => 'EB-'.date('Y').'-0001',
            'document_type' => 'eingang',
            'title' => 'Rechnung Bürobedarf Schmidt KG',
            'document_date' => now()->subDays(2)->toDateString(),
            'amount' => 17850, 'tax_amount' => 2850,
            'contact_id' => $lieferant->id,
            'status' => 'draft',
            'due_date' => now()->addDays(12)->toDateString(),
        ]);

        // 10. Projekte & Kostenstellen (SPEC-08, Teil A): ein internes Projekt
        // (contact_id null - eigenes Produkt "BieneB") und ein Kundenprojekt
        // (mit Kontakt), je mit ein paar dimensionierten Kosten-/Erlösbuchungen.
        // Anlage mimikt ProjectController::store() (Nummer + dedizierter
        // Kostenträger in einer Transaktion).
        $verwaltung = CostCenter::create(['code' => 'CC-VERW', 'name' => 'Verwaltung', 'active' => true]);
        $entwicklung = CostCenter::create(['code' => 'CC-ENTW', 'name' => 'Entwicklung', 'active' => true]);

        $bieneBNumber = $numberSequenceService->next('project');
        $bieneBCostObject = CostObject::create(['code' => $bieneBNumber, 'name' => 'BieneB', 'active' => true]);
        $bieneB = Project::create([
            'number' => $bieneBNumber,
            'name' => 'BieneB',
            'contact_id' => null, // internes Projekt, kein Kunde
            'cost_object_id' => $bieneBCostObject->id,
            'budget_amount' => 1000000,
            'starts_on' => now()->subMonths(2)->toDateString(),
            'status' => 'active',
            'notes' => 'Internes Produktprojekt ohne Kundenbezug.',
        ]);

        $websiteNumber = $numberSequenceService->next('project');
        $websiteCostObject = CostObject::create(['code' => $websiteNumber, 'name' => 'Website Relaunch Muster GmbH', 'active' => true]);
        $websiteProjekt = Project::create([
            'number' => $websiteNumber,
            'name' => 'Website Relaunch Muster GmbH',
            'contact_id' => $kunde->id,
            'cost_object_id' => $websiteCostObject->id,
            'budget_amount' => 800000,
            'starts_on' => now()->subMonth()->toDateString(),
            'status' => 'active',
        ]);

        // Dimensionierte Kostenbuchung für BieneB (interne Entwicklung).
        $bieneBCost = $bookingService->createBooking([
            'date' => now()->subDays(6)->toDateString(),
            'description' => 'Fremdleistung BieneB (dimensioniert)',
            'contact_id' => $lieferant->id,
            'lines' => [
                [
                    'account_id' => $expense->id, 'type' => 'debit', 'amount' => 20000,
                    'tax_amount' => 3800, 'cost_center_id' => $entwicklung->id, 'cost_object_id' => $bieneBCostObject->id,
                ],
                ['account_id' => $this->account('1576', 'asset')->id, 'type' => 'debit', 'amount' => 3800],
                ['account_id' => $bank->id, 'type' => 'credit', 'amount' => 23800],
            ],
        ]);
        $bookingService->lockBooking($bieneBCost->id);

        // Dimensionierte Erlösbuchung für das Kundenprojekt (Barverkauf/Akonto).
        $websiteErloes = $bookingService->createBooking([
            'date' => now()->subDays(3)->toDateString(),
            'description' => 'Akonto Website Relaunch (dimensioniert)',
            'contact_id' => $kunde->id,
            'lines' => [
                ['account_id' => $bank->id, 'type' => 'debit', 'amount' => 250000],
                [
                    'account_id' => $revenue->id, 'type' => 'credit', 'amount' => 250000,
                    'cost_center_id' => $verwaltung->id, 'cost_object_id' => $websiteCostObject->id,
                ],
            ],
        ]);
        $bookingService->lockBooking($websiteErloes->id);

        $this->command->info('✅ Demo-Tenant angelegt: '.$tenant->name.' (/'.$tenant->slug.')');
        $this->command->line('   Login: '.self::DEMO_EMAIL.' / password');
    }

    /**
     * Konto per Code holen, Fallback: erstes Konto des Typs.
     */
    private function account(string $code, string $type): Account
    {
        return Account::where('code', $code)->first()
            ?? Account::where('type', $type)->orderBy('code')->firstOrFail();
    }

    /**
     * @param  array<int, array{description: string, quantity: int, unit: string, unit_price: int, product_id?: int}>  $lines
     */
    private function createDraftInvoice(string $number, int $contactId, int $revenueAccountId, array $lines): void
    {
        $subtotal = 0;
        $taxTotal = 0;
        foreach ($lines as $line) {
            $lineTotal = (int) ($line['quantity'] * $line['unit_price']);
            $subtotal += $lineTotal;
            $taxTotal += (int) round($lineTotal * 0.19);
        }

        $invoice = Invoice::create([
            'invoice_number' => $number,
            'contact_id' => $contactId,
            'invoice_date' => now()->subDays(1)->toDateString(),
            'due_date' => now()->addDays(14)->toDateString(),
            'status' => 'draft',
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'total' => $subtotal + $taxTotal,
            'payment_terms' => 'Zahlbar innerhalb 14 Tagen, rein netto',
        ]);

        foreach ($lines as $line) {
            $invoice->lines()->create([
                'product_id' => $line['product_id'] ?? null,
                'description' => $line['description'],
                'quantity' => $line['quantity'],
                'unit' => $line['unit'],
                'unit_price' => $line['unit_price'],
                'tax_rate' => 19,
                'line_total' => (int) ($line['quantity'] * $line['unit_price']),
                'account_id' => $revenueAccountId,
            ]);
        }
    }
}
