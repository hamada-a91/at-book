<?php

namespace Tests\Support;

use App\Models\BankAccount;
use App\Models\Beleg;
use App\Models\CompanySetting;
use App\Models\DeliveryNote;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Quote;
use App\Models\TaxCode;
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
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

/**
 * Baut einen vollständigen, realistischen Tenant-Datenbestand für Tests auf.
 *
 * Orientiert sich an database/seeders/DemoTenantSeeder, ist aber schlanker
 * und für wiederholten Aufruf in Tests gedacht (z.B. Tenant A + Tenant B im
 * selben Test). Jeder Aufruf erzeugt einen eindeutigen Tenant/Slug/E-Mail
 * (Zufalls-Suffix), damit mehrere Aufrufe in derselben Testmethode nicht
 * kollidieren.
 *
 * WICHTIG: setzt als Seiteneffekt app()->instance('currentTenant', $tenant)
 * und Auth::setUser($owner) auf den zuletzt erzeugten Tenant (Global Scope
 * bzw. BookingService::Auth::id() brauchen das außerhalb von HTTP-Requests).
 * Beim Wechsel zwischen zwei Tenants (Tenant A -> Tenant B) muss der Aufrufer
 * ggf. den Kontext nach eigenem Bedarf erneut umschalten.
 */
class TenantTestDataFactory
{
    public static function create(?string $suffix = null): TenantTestData
    {
        $suffix = $suffix ?? Str::lower(Str::random(8));

        return DB::transaction(function () use ($suffix) {
            // 1. Tenant + Owner
            $tenant = Tenant::create([
                'name' => "Test Firma {$suffix} GmbH",
                'slug' => "test-firma-{$suffix}",
            ]);

            $owner = User::create([
                'name' => 'Test Owner',
                'email' => "owner-{$suffix}@at-book.test",
                'password' => Hash::make('password'),
                'tenant_id' => $tenant->id,
            ]);
            $owner->assignRole(Role::firstOrCreate(['name' => 'owner', 'guard_name' => 'api']));

            // Tenant-Kontext + Auth setzen: Global Scopes und BookingService
            // (Auth::id() für user_id) brauchen beides außerhalb von HTTP-Requests.
            app()->instance('currentTenant', $tenant);
            Auth::setUser($owner);

            // 2. Firmeneinstellungen (Onboarding abgeschlossen, Lagerverwaltung an)
            $companySetting = CompanySetting::create([
                'company_name' => $tenant->name,
                'street' => 'Teststraße 1',
                'zip' => '10115',
                'city' => 'Berlin',
                'country' => 'Deutschland',
                'email' => "info-{$suffix}@at-book.test",
                'tax_number' => 'DE'.random_int(100000000, 999999999),
                'tax_type' => 'umsatzsteuer_pflichtig',
                'business_models' => json_encode(['dienstleistungen', 'handel']),
                'legal_form' => 'gmbh',
                'account_plan_initialized_at' => now(),
                'onboarding_completed' => true,
            ]);
            $companySetting->module_inventory_enabled = true; // nicht im $fillable
            $companySetting->save();

            // 3. SKR03-Kontenplan (liefert u.a. 1200/8400/4930/1776)
            $generator = new Skr03AccountPlanGenerator;
            foreach ($generator->generateAccounts(['dienstleistungen', 'handel'], 'gmbh') as $accountData) {
                if (! Account::where('code', $accountData['code'])->exists()) {
                    Account::create($accountData);
                }
            }

            $accountBank = self::account('1200', 'asset');
            $accountRevenue = self::account('8400', 'revenue');
            $accountExpense = self::account('4930', 'expense');
            $accountTax = self::account('1776', 'liability');

            // 4. Kontakte mit Personenkonten
            $accountDebitor = Account::create([
                'code' => '10001', 'name' => 'Debitor: Muster GmbH', 'type' => 'asset', 'category' => 'Debitoren',
            ]);
            $customer = Contact::create([
                'name' => 'Muster GmbH',
                'type' => 'customer',
                'email' => "kunde-{$suffix}@muster-gmbh.de",
                'address' => "Kundenweg 1\n80331 München",
                'customer_account_id' => $accountDebitor->id,
            ]);

            $accountKreditor = Account::create([
                'code' => '70001', 'name' => 'Kreditor: Schmidt KG', 'type' => 'liability', 'category' => 'Kreditoren',
            ]);
            $vendor = Contact::create([
                'name' => 'Bürobedarf Schmidt KG',
                'type' => 'vendor',
                'email' => "lieferant-{$suffix}@schmidt-kg.de",
                'address' => "Lieferantenallee 9\n50667 Köln",
                'vendor_account_id' => $accountKreditor->id,
            ]);

            // 5. Produkte + Lagerbestand
            $category = ProductCategory::create(['name' => 'IT & Hardware']);
            $productGoods = Product::create([
                'type' => 'goods', 'name' => 'Business Laptop 15"', 'article_number' => "HW-{$suffix}",
                'unit' => 'Stück', 'price_net' => 89900, 'price_gross' => 106981, 'tax_rate' => 19,
                'track_stock' => true, 'stock_quantity' => 0, 'reorder_level' => 3,
                'account_id' => $accountRevenue->id, 'category_id' => $category->id,
            ]);
            $productService = Product::create([
                'type' => 'service', 'name' => 'IT-Beratung', 'article_number' => "DL-{$suffix}",
                'unit' => 'Stunde', 'price_net' => 12000, 'price_gross' => 14280, 'tax_rate' => 19,
                'track_stock' => false, 'account_id' => $accountRevenue->id, 'category_id' => $category->id,
            ]);
            (new InventoryService)->addStock($productGoods, 10, 'purchase', 'Anfangsbestand (Testdaten)');

            // 6. Bankkonto
            $bankAccount = BankAccount::create([
                'name' => 'Geschäftskonto', 'bank_name' => 'Test Bank AG',
                'iban' => 'DE'.random_int(10, 99).'12030000'.random_int(1000000, 9999999),
                'bic' => 'BYLADEM1001',
                'currency' => 'EUR', 'is_default' => true, 'account_id' => $accountBank->id,
            ]);

            // 7. Steuerschlüssel
            $taxCode = TaxCode::create([
                'code' => 'UST19',
                'name' => 'Umsatzsteuer 19%',
                'type' => 'output_tax',
                'rate' => 19,
                'account_id' => $accountTax->id,
            ]);

            // 8. Belegkette: Angebot -> Auftrag -> Rechnung (mit Zeilen)
            $quote = Quote::create([
                'contact_id' => $customer->id,
                'quote_number' => "AN-{$suffix}-0001",
                'quote_date' => now()->subDays(20)->toDateString(),
                'valid_until' => now()->addDays(10)->toDateString(),
                'status' => 'ordered',
                'subtotal' => 89900 + 3 * 12000,
                'tax_total' => (int) round((89900 + 3 * 12000) * 0.19),
                'total' => 0, // unten korrekt gesetzt
                'payment_terms' => 'Zahlbar innerhalb 14 Tagen, rein netto',
            ]);
            $quote->update(['total' => $quote->subtotal + $quote->tax_total]);
            $quote->lines()->create([
                'product_id' => $productGoods->id,
                'description' => 'Business Laptop 15"',
                'quantity' => 1,
                'unit' => 'Stück',
                'unit_price' => 89900,
                'tax_rate' => 19,
                'line_total' => 89900,
            ]);
            $quote->lines()->create([
                'product_id' => $productService->id,
                'description' => 'Einrichtung vor Ort',
                'quantity' => 3,
                'unit' => 'Stunde',
                'unit_price' => 12000,
                'tax_rate' => 19,
                'line_total' => 3 * 12000,
            ]);

            $order = Order::create([
                'contact_id' => $customer->id,
                'quote_id' => $quote->id,
                'order_number' => "AU-{$suffix}-0001",
                'order_date' => now()->subDays(15)->toDateString(),
                'status' => 'invoiced',
                'subtotal' => $quote->subtotal,
                'tax_total' => $quote->tax_total,
                'total' => $quote->total,
                'payment_terms' => $quote->payment_terms,
            ]);
            $orderLineGoods = $order->lines()->create([
                'product_id' => $productGoods->id,
                'description' => 'Business Laptop 15"',
                'quantity' => 1,
                'delivered_quantity' => 1,
                'invoiced_quantity' => 1,
                'unit' => 'Stück',
                'unit_price' => 89900,
                'tax_rate' => 19,
                'line_total' => 89900,
            ]);
            $order->lines()->create([
                'product_id' => $productService->id,
                'description' => 'Einrichtung vor Ort',
                'quantity' => 3,
                'delivered_quantity' => 3,
                'invoiced_quantity' => 3,
                'unit' => 'Stunde',
                'unit_price' => 12000,
                'tax_rate' => 19,
                'line_total' => 3 * 12000,
            ]);

            $deliveryNote = DeliveryNote::create([
                'contact_id' => $customer->id,
                'order_id' => $order->id,
                'delivery_note_number' => "LS-{$suffix}-0001",
                'delivery_date' => now()->subDays(12)->toDateString(),
                'status' => 'sent',
            ]);
            $deliveryNote->lines()->create([
                'order_line_id' => $orderLineGoods->id,
                'description' => 'Business Laptop 15"',
                'quantity' => 1,
                'unit' => 'Stück',
            ]);

            // Rechnung als Draft (Buchen wird separat in InvoiceBookingTest getestet)
            $invoice = Invoice::create([
                'invoice_number' => "RE-{$suffix}-0001",
                'contact_id' => $customer->id,
                'order_id' => $order->id,
                'invoice_date' => now()->subDays(10)->toDateString(),
                'due_date' => now()->addDays(4)->toDateString(),
                'status' => 'draft',
                'subtotal' => $order->subtotal,
                'tax_total' => $order->tax_total,
                'total' => $order->total,
                'payment_terms' => 'Zahlbar innerhalb 14 Tagen, rein netto',
            ]);
            $invoice->lines()->create([
                'product_id' => $productGoods->id,
                'description' => 'Business Laptop 15"',
                'quantity' => 1,
                'unit' => 'Stück',
                'unit_price' => 89900,
                'tax_rate' => 19,
                'line_total' => 89900,
                'account_id' => $accountRevenue->id,
            ]);
            $invoice->lines()->create([
                'product_id' => $productService->id,
                'description' => 'Einrichtung vor Ort',
                'quantity' => 3,
                'unit' => 'Stunde',
                'unit_price' => 12000,
                'tax_rate' => 19,
                'line_total' => 3 * 12000,
                'account_id' => $accountRevenue->id,
            ]);

            // 9. Eingangsbeleg mit Zeile
            $beleg = Beleg::create([
                'document_number' => "EB-{$suffix}-0001",
                'document_type' => 'eingang',
                'title' => 'Rechnung Bürobedarf Schmidt KG',
                'document_date' => now()->subDays(5)->toDateString(),
                'amount' => 17850,
                'tax_amount' => 2850,
                'contact_id' => $vendor->id,
                'category_account_id' => $accountExpense->id,
                'payment_account_id' => $accountBank->id,
                'status' => 'draft',
                'due_date' => now()->addDays(9)->toDateString(),
            ]);
            $beleg->lines()->create([
                'description' => 'Bürobedarf',
                'quantity' => 1,
                'unit' => 'Stück',
                'unit_price' => 15000,
                'tax_rate' => 19,
                'line_total' => 15000,
                'account_id' => $accountExpense->id,
            ]);

            // 10. Journalbuchungen in allen Status (über den BookingService!)
            $bookingService = new BookingService;

            $journalDraft = $bookingService->createBooking([
                'date' => now()->subDays(3)->toDateString(),
                'description' => 'Büromaterial (Entwurf)',
                'contact_id' => $vendor->id,
                'lines' => [
                    ['account_id' => $accountExpense->id, 'type' => 'debit', 'amount' => 5950],
                    ['account_id' => $accountBank->id, 'type' => 'credit', 'amount' => 5950],
                ],
            ]);

            $journalPosted = $bookingService->createBooking([
                'date' => now()->subDays(10)->toDateString(),
                'description' => 'Barverkauf Dienstleistung',
                'contact_id' => $customer->id,
                'lines' => [
                    ['account_id' => $accountBank->id, 'type' => 'debit', 'amount' => 119000],
                    ['account_id' => $accountRevenue->id, 'type' => 'credit', 'amount' => 119000],
                ],
            ]);
            $bookingService->lockBooking($journalPosted->id);
            $journalPosted->refresh();

            $journalCancelled = $bookingService->createBooking([
                'date' => now()->subDays(7)->toDateString(),
                'description' => 'Fehlbuchung (wird storniert)',
                'lines' => [
                    ['account_id' => $accountExpense->id, 'type' => 'debit', 'amount' => 25000],
                    ['account_id' => $accountBank->id, 'type' => 'credit', 'amount' => 25000],
                ],
            ]);
            $bookingService->lockBooking($journalCancelled->id);
            $journalReversal = $bookingService->reverseBooking($journalCancelled->id);
            $journalCancelled->refresh();

            // 11. SPEC-08 (Teil A): Kostenstelle + Kundenprojekt (mit eigenem,
            // automatisch angelegtem Kostenträger, analog zu
            // ProjectController::store()) + eine projekt-dimensionierte,
            // festgeschriebene Kostenbuchung - deckt den Backup-Roundtrip für die
            // 3 neuen Entities + die neuen *_public_id-Felder auf den Zeilen ab.
            $costCenter = CostCenter::create([
                'code' => "CC-{$suffix}",
                'name' => 'Verwaltung',
                'active' => true,
            ]);

            $projectNumber = (new NumberSequenceService)->next('project');
            $projectCostObject = CostObject::create([
                'code' => $projectNumber,
                'name' => 'Website Relaunch',
                'active' => true,
            ]);
            $project = Project::create([
                'number' => $projectNumber,
                'name' => 'Website Relaunch',
                'contact_id' => $customer->id,
                'cost_object_id' => $projectCostObject->id,
                'budget_amount' => 500000,
                'starts_on' => now()->subDays(30)->toDateString(),
                'status' => 'active',
            ]);

            // Kostenbuchung dimensioniert auf Kostenstelle + Projekt-Kostenträger -
            // netto/USt/brutto-Annotation analog zur Durchreich-Logik in
            // InvoiceBookingService::buildLines()/BelegController::book() (siehe
            // ProjectReportService-Docblock).
            $journalProjectCost = $bookingService->createBooking([
                'date' => now()->subDays(4)->toDateString(),
                'description' => 'Fremdleistung für Projekt (dimensioniert)',
                'contact_id' => $vendor->id,
                'lines' => [
                    [
                        'account_id' => $accountExpense->id, 'type' => 'debit', 'amount' => 10000,
                        'tax_amount' => 1900, 'cost_center_id' => $costCenter->id, 'cost_object_id' => $projectCostObject->id,
                    ],
                    ['account_id' => $accountTax->id, 'type' => 'debit', 'amount' => 1900],
                    ['account_id' => $accountBank->id, 'type' => 'credit', 'amount' => 11900],
                ],
            ]);
            $bookingService->lockBooking($journalProjectCost->id);
            $journalProjectCost->refresh();

            return new TenantTestData(
                tenant: $tenant,
                user: $owner,
                accountBank: $accountBank,
                accountRevenue: $accountRevenue,
                accountExpense: $accountExpense,
                accountTax: $accountTax,
                accountDebitor: $accountDebitor,
                accountKreditor: $accountKreditor,
                customer: $customer,
                vendor: $vendor,
                category: $category,
                productGoods: $productGoods,
                productService: $productService,
                bankAccount: $bankAccount,
                companySetting: $companySetting,
                taxCode: $taxCode,
                quote: $quote,
                order: $order,
                invoice: $invoice,
                deliveryNote: $deliveryNote,
                beleg: $beleg,
                journalDraft: $journalDraft,
                journalPosted: $journalPosted,
                journalCancelled: $journalCancelled,
                journalReversal: $journalReversal,
                costCenter: $costCenter,
                project: $project,
                projectCostObject: $projectCostObject,
                journalProjectCost: $journalProjectCost,
            );
        });
    }

    /**
     * Konto per Code holen, Fallback: erstes Konto des Typs.
     */
    private static function account(string $code, string $type): Account
    {
        return Account::where('code', $code)->first()
            ?? Account::where('type', $type)->orderBy('code')->firstOrFail();
    }
}
