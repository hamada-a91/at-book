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
    public function index()
    {
        $contacts = Contact::with('account.journalEntryLines')->orderBy('name')->get();
        
        return $contacts->map(function ($contact) {
            $data = $contact->toArray();
            
            if ($contact->account) {
                $data['balance'] = $this->calculateAccountBalance($contact->account);
                $data['balance_formatted'] = $this->formatCurrency($data['balance']);
            } else {
                $data['balance'] = 0;
                $data['balance_formatted'] = '0,00 €';
            }
            
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
            'type' => 'required|in:customer,vendor',
            'tax_number' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'email' => 'nullable|email',
            'phone' => 'nullable|string',
            'notice' => 'nullable|string',
            'bank_account' => 'nullable|string|max:255',
            'contact_person' => 'nullable|string|max:255',
        ]);

        // Determine account code based on contact type
        $baseCode = $validated['type'] === 'customer' ? 10000 : 70000;
        
        // Find the next available account code
        $lastAccount = \App\Modules\Accounting\Models\Account::where('code', 'like', $baseCode . '%')
            ->orderBy('code', 'desc')
            ->first();
        
        $nextCode = $baseCode + 1;
        if ($lastAccount) {
            $nextCode = intval($lastAccount->code) + 1;
        }
        
        // Create the account
        $account = \App\Modules\Accounting\Models\Account::create([
            'code' => (string)$nextCode,
            'name' => $validated['name'],
            'type' => $validated['type'] === 'customer' ? 'asset' : 'liability',
            'tax_key_code' => null,
            'is_system' => false,
        ]);
        
        // Create the contact with the account_id
        $validated['account_id'] = $account->id;
        $contact = Contact::create($validated);

        return response()->json($contact->load('account'), 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        return Contact::findOrFail($id);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $contact = Contact::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:customer,vendor',
            'tax_number' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'email' => 'nullable|email',
            'phone' => 'nullable|string',
            'notice' => 'nullable|string',
            'bank_account' => 'nullable|string|max:255',
            'contact_person' => 'nullable|string|max:255',
        ]);

        $contact->update($validated);

        return response()->json($contact);
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
