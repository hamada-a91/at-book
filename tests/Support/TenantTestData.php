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
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Contacts\Models\Contact;

/**
 * Value object returned by TenantTestDataFactory::create().
 *
 * Bündelt einen frisch geseedeten Tenant mit einem realistischen
 * Datenbestand für Tests (siehe SPEC-02, Abschnitt 2.1).
 */
class TenantTestData
{
    public function __construct(
        public Tenant $tenant,
        public User $user,
        public Account $accountBank,
        public Account $accountRevenue,
        public Account $accountExpense,
        public Account $accountTax,
        public Account $accountDebitor,
        public Account $accountKreditor,
        public Contact $customer,
        public Contact $vendor,
        public ProductCategory $category,
        public Product $productGoods,
        public Product $productService,
        public BankAccount $bankAccount,
        public CompanySetting $companySetting,
        public TaxCode $taxCode,
        public Quote $quote,
        public Order $order,
        public Invoice $invoice,
        public DeliveryNote $deliveryNote,
        public Beleg $beleg,
        public JournalEntry $journalDraft,
        public JournalEntry $journalPosted,
        public JournalEntry $journalCancelled,
        public JournalEntry $journalReversal,
    ) {}
}
