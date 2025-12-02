<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Contacts\Models\Contact;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $contacts = Contact::with(['customerAccount.journalEntryLines', 'vendorAccount.journalEntryLines'])->orderBy('name')->get();
        
        return $contacts->map(function ($contact) {
            $data = $contact->toArray();
            
            $customerBalance = 0;
            $vendorBalance = 0;

            if ($contact->customerAccount) {
                $customerBalance = $this->calculateAccountBalance($contact->customerAccount);
            }
            
            if ($contact->vendorAccount) {
                $vendorBalance = $this->calculateAccountBalance($contact->vendorAccount);
            }

            // Net balance: Assets (Receivables) - Liabilities (Payables)
            // If positive: Customer owes us. If negative: We owe vendor.
            $netBalance = $customerBalance + $vendorBalance; // Note: Vendor balance is returned as negative by calculateAccountBalance for liability accounts if we follow standard accounting logic, but let's check the helper.
            
            // Actually, let's keep it simple.
            // Customer Account (Asset): Debit - Credit. Positive = They owe us.
            // Vendor Account (Liability): Credit - Debit. Positive = We owe them.
            
            // Let's display them separately or net?
            // Requirement says "automatically die beide kontos bekommt".
            // Let's return both balances and a net balance.
            
            $data['customer_balance'] = $customerBalance;
            $data['vendor_balance'] = $vendorBalance;
            
            // For the main list view, we might want a single "Balance" column.
            // If it's a customer: Customer Balance.
            // If it's a vendor: Vendor Balance.
            // If both: Net? Or just show both?
            // Let's show Net Balance where (Receivables - Payables).
            // Receivables = Debit - Credit (Asset)
            // Payables = Credit - Debit (Liability)
            
            // calculateAccountBalance returns:
            // Asset: Debit - Credit
            // Liability: Credit - Debit
            
            // So if I have 100 Receivable (Asset > 0) and 20 Payable (Liability > 0).
            // Net position: +80 (They owe us 80).
            // Formula: AssetBalance - LiabilityBalance.
            
            $data['balance'] = $customerBalance - $vendorBalance;
            $data['balance_formatted'] = $this->formatCurrency($data['balance']);
            
            return $data;
        });
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:customer,vendor,both,other',
            'tax_number' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'email' => 'nullable|email',
            'phone' => 'nullable|string',
            'notice' => 'nullable|string',
            'bank_account' => 'nullable|string|max:255',
            'contact_person' => 'nullable|string|max:255',
        ]);

        $customerAccountId = null;
        $vendorAccountId = null;

        // Create Customer Account (Debitor)
        if (in_array($validated['type'], ['customer', 'both'])) {
            $customerAccountId = $this->createAccount($validated['name'], 'customer');
        }

        // Create Vendor Account (Kreditor)
        if (in_array($validated['type'], ['vendor', 'both'])) {
            $vendorAccountId = $this->createAccount($validated['name'], 'vendor');
        }
        
        // For 'other' type, no accounts are created automatically.
        
        $validated['customer_account_id'] = $customerAccountId;
        $validated['vendor_account_id'] = $vendorAccountId;
        
        $contact = Contact::create($validated);

        return response()->json($contact->load(['customerAccount', 'vendorAccount']), 201);
    }

    /**
     * Create an account for the contact
     */
    private function createAccount(string $name, string $type): int
    {
        // Determine account code based on contact type
        $baseCode = $type === 'customer' ? 10000 : 70000;
        
        // Find the next available account code
        $lastAccount = \App\Modules\Accounting\Models\Account::where('code', 'like', $baseCode . '%')
            ->orderBy('code', 'desc')
            ->first();
        
        $nextCode = $baseCode + 1;
        if ($lastAccount) {
            $nextCode = intval($lastAccount->code) + 1;
        }
        
        // Ensure the code is unique (in case of gaps)
        while (\App\Modules\Accounting\Models\Account::where('code', (string)$nextCode)->exists()) {
            $nextCode++;
        }
        
        // Create the account
        $account = \App\Modules\Accounting\Models\Account::create([
            'code' => (string)$nextCode,
            'name' => $name,
            'type' => $type === 'customer' ? 'asset' : 'liability',
            'tax_key_code' => null,
            'is_system' => false,
        ]);

        return $account->id;
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        return Contact::with(['customerAccount', 'vendorAccount'])->findOrFail($id);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $contact = Contact::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:customer,vendor,both,other',
            'tax_number' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'email' => 'nullable|email',
            'phone' => 'nullable|string',
            'notice' => 'nullable|string',
            'bank_account' => 'nullable|string|max:255',
            'contact_person' => 'nullable|string|max:255',
        ]);

        // Handle type change logic if needed (e.g. creating missing accounts)
        // If changing to 'both' from 'customer', create vendor account if missing.
        if ($validated['type'] === 'both') {
            if (!$contact->customer_account_id) {
                $contact->customer_account_id = $this->createAccount($validated['name'], 'customer');
            }
            if (!$contact->vendor_account_id) {
                $contact->vendor_account_id = $this->createAccount($validated['name'], 'vendor');
            }
        } elseif ($validated['type'] === 'customer') {
             if (!$contact->customer_account_id) {
                $contact->customer_account_id = $this->createAccount($validated['name'], 'customer');
            }
        } elseif ($validated['type'] === 'vendor') {
             if (!$contact->vendor_account_id) {
                $contact->vendor_account_id = $this->createAccount($validated['name'], 'vendor');
            }
        }
        
        // Update name in accounts if changed
        if ($validated['name'] !== $contact->name) {
            if ($contact->customerAccount) {
                $contact->customerAccount->update(['name' => $validated['name']]);
            }
            if ($contact->vendorAccount) {
                $contact->vendorAccount->update(['name' => $validated['name']]);
            }
        }

        $contact->update($validated);

        return response()->json($contact->load(['customerAccount', 'vendorAccount']));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $contact = Contact::findOrFail($id);

        if ($contact->bookings()->exists()) {
            return response()->json(['error' => 'Kontakt kann nicht gelöscht werden, da Buchungen existieren.'], 409);
        }

        // Also check if accounts have bookings (should be covered by contact->bookings relation usually, but let's be safe)
        // Actually, bookings are linked to accounts, not contacts directly in the DB schema for lines?
        // No, bookings have contact_id. Lines have account_id.
        
        // If we delete contact, we should check if its accounts have entries.
        if ($contact->customerAccount && $contact->customerAccount->journalEntryLines()->exists()) {
             return response()->json(['error' => 'Kontakt kann nicht gelöscht werden, da Buchungen auf dem Debitorenkonto existieren.'], 409);
        }
        if ($contact->vendorAccount && $contact->vendorAccount->journalEntryLines()->exists()) {
             return response()->json(['error' => 'Kontakt kann nicht gelöscht werden, da Buchungen auf dem Kreditorenkonto existieren.'], 409);
        }

        // Delete accounts if they have no other usage (which they shouldn't as they are personal)
        if ($contact->customerAccount) $contact->customerAccount->delete();
        if ($contact->vendorAccount) $contact->vendorAccount->delete();

        $contact->delete();

        return response()->json(['message' => 'Kontakt gelöscht']);
    }
    
    /**
     * Calculate balance for an account
     */
    private function calculateAccountBalance($account): int
    {
        $debitSum = $account->journalEntryLines()
            ->where('type', 'debit')
            ->sum('amount');
            
        $creditSum = $account->journalEntryLines()
            ->where('type', 'credit')
            ->sum('amount');
        
        // Customer accounts (asset): Debit - Credit
        // Vendor accounts (liability): Credit - Debit
        if ($account->type === 'asset') {
            return $debitSum - $creditSum;
        } else {
            return $creditSum - $debitSum;
        }
    }
    
    /**
     * Format currency in cents to Euro string
     */
    private function formatCurrency(int $cents): string
    {
        $euros = $cents / 100;
        return number_format($euros, 2, ',', '.') . ' €';
    }
}
