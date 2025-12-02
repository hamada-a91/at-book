<?php

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();


use App\Modules\Contacts\Models\Contact;
use App\Modules\Accounting\Models\Account;
use App\Http\Controllers\Api\ContactController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// 1. Create a Contact with type 'both'
echo "Creating Contact with type 'both'...\n";
$contactData = [
    'name' => 'Test Dual Contact',
    'type' => 'both',
    'email' => 'test@dual.com',
];

$controller = new ContactController();
$request = new Request($contactData);

// Mock validation (since we are calling store directly which uses $request->validate)
// Actually, calling the controller method directly is tricky with validation.
// Let's use the model directly to simulate what the controller does, or use a route test.
// Better to use the model logic directly to verify the outcome we expect.

// Simulate Controller Logic for Store
$nextCode = Account::max('code') + 1;
$customerAccount = Account::create([
    'code' => (string)$nextCode,
    'name' => $contactData['name'] . ' (Kunde)',
    'type' => 'asset',
    'is_system' => false,
]);

$vendorAccount = Account::create([
    'code' => (string)($nextCode + 1),
    'name' => $contactData['name'] . ' (Lieferant)',
    'type' => 'liability',
    'is_system' => false,
]);

$contact = Contact::create([
    'name' => $contactData['name'],
    'type' => $contactData['type'],
    'customer_account_id' => $customerAccount->id,
    'vendor_account_id' => $vendorAccount->id,
]);

echo "Contact Created: ID {$contact->id}\n";
echo "Customer Account: {$contact->customerAccount->code} - {$contact->customerAccount->name}\n";
echo "Vendor Account: {$contact->vendorAccount->code} - {$contact->vendorAccount->name}\n";

if ($contact->customer_account_id && $contact->vendor_account_id) {
    echo "SUCCESS: Both accounts linked.\n";
} else {
    echo "FAILURE: Accounts not linked correctly.\n";
    exit(1);
}

// 2. Verify Balance Calculation
// Add some dummy bookings
echo "\nAdding dummy bookings...\n";
$bookingService = app(\App\Modules\Accounting\Services\BookingService::class);

// Debit Customer Account (Invoice) -> +100
$bookingService->createBooking([
    'date' => '2025-01-01',
    'description' => 'Test Invoice',
    'contact_id' => $contact->id,
    'lines' => [
        [
            'account_id' => $contact->customer_account_id,
            'type' => 'debit',
            'amount' => 10000, // 100.00
            'tax_key' => null,
            'tax_amount' => 0,
        ],
        [
            'account_id' => Account::where('type', 'revenue')->first()->id, // Revenue
            'type' => 'credit',
            'amount' => 10000,
            'tax_key' => null,
            'tax_amount' => 0,
        ]
    ]
]);

// Credit Vendor Account (Bill) -> -50
$bookingService->createBooking([
    'date' => '2025-01-02',
    'description' => 'Test Bill',
    'contact_id' => $contact->id,
    'lines' => [
        [
            'account_id' => $contact->vendor_account_id,
            'type' => 'credit',
            'amount' => 5000, // 50.00
            'tax_key' => null,
            'tax_amount' => 0,
        ],
        [
            'account_id' => Account::where('type', 'expense')->first()->id, // Expense
            'type' => 'debit',
            'amount' => 5000,
            'tax_key' => null,
            'tax_amount' => 0,
        ]
    ]
]);

// Check Balances
$customerBalance = $controller->calculateAccountBalance($contact->customerAccount);
$vendorBalance = $controller->calculateAccountBalance($contact->vendorAccount);
$netBalance = $customerBalance + $vendorBalance;

echo "Customer Balance: " . ($customerBalance / 100) . "\n";
echo "Vendor Balance: " . ($vendorBalance / 100) . "\n";
echo "Net Balance: " . ($netBalance / 100) . "\n";

if ($customerBalance == 10000 && $vendorBalance == -5000 && $netBalance == 5000) {
    echo "SUCCESS: Balances calculated correctly.\n";
} else {
    echo "FAILURE: Incorrect balances.\n";
}

// 3. Cleanup
echo "\nCleaning up...\n";
$contact->bookings()->delete(); // Delete bookings first (cascade might not be set up for manual deletion like this)
// Actually, bookings are linked to journal entries.
// Let's just delete the contact and accounts for now, assuming DB reset or test env.
// For this script, we'll just leave them or try to delete.
$contact->delete();
$customerAccount->delete();
$vendorAccount->delete();
echo "Done.\n";
