<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\HasTenantScope;
use App\Models\BankAccount;
use App\Modules\Accounting\Models\Account;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class BankAccountController extends Controller
{
    use HasTenantScope;

    /**
     * Display a listing of bank accounts
     */
    public function index(): JsonResponse
    {
        $tenant = $this->getTenantOrFail();
        $accounts = BankAccount::where('tenant_id', $tenant->id)
            ->with('account')
            ->orderBy('is_default', 'desc')
            ->orderBy('id', 'desc')
            ->get()
            ->map(function ($account) {
                $data = $account->toArray();
                $data['balance_formatted'] = $account->balance_formatted;
                $data['formatted_iban'] = $account->formatted_iban;
                $data['sachkonto_code'] = $account->account?->code;
                $data['sachkonto_name'] = $account->account?->name;
                return $data;
            });

        return response()->json($accounts);
    }

    /**
     * Store a newly created bank account
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'bank_name' => 'required|string|max:255',
            'iban' => 'required|string|max:34|unique:bank_accounts,iban',
            'bic' => 'nullable|string|max:11',
            'account_number' => 'nullable|string|max:50',
            'bank_code' => 'nullable|string|max:8',
            'currency' => 'nullable|in:EUR,USD,GBP,CHF',
            'type' => 'nullable|in:checking,savings,credit_card',
            'is_default' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        $tenant = $this->getTenantOrFail();

        // Set defaults
        $validated['currency'] = $validated['currency'] ?? 'EUR';
        $validated['type'] = $validated['type'] ?? 'checking';
        $validated['balance'] = 0; // Start with 0 balance

        // Check if this is the first/standard bank account
        $existingBankAccounts = BankAccount::where('tenant_id', $tenant->id)->count();
        
        // Find or create the Sachkonto (accounting account) for this bank account
        if ($existingBankAccounts === 0 || ($validated['is_default'] ?? false)) {
            // First/Standard account - try to find existing "Bank" account (code 1200)
            $sachkonto = Account::where('tenant_id', $tenant->id)
                ->where('code', '1200')
                ->first();
            
            if (!$sachkonto) {
                // Create the standard bank account
                $sachkonto = Account::create([
                    'tenant_id' => $tenant->id,
                    'code' => '1200',
                    'name' => 'Bank',
                    'type' => 'asset',
                ]);
            }
        } else {
            // Extra bank account - create new Sachkonto with incremented number
            // Find the highest bank account code starting with 12xx
            $lastBankAccount = Account::where('tenant_id', $tenant->id)
                ->where('code', 'like', '12%')
                ->where('code', '!=', '1200')
                ->orderBy('code', 'desc')
                ->first();
            
            $nextCode = $lastBankAccount 
                ? (string)(intval($lastBankAccount->code) + 1) 
                : '1201';
            
            // Create new Sachkonto for this bank account
            $sachkonto = Account::create([
                'tenant_id' => $tenant->id,
                'code' => $nextCode,
                'name' => 'Bank ' . $validated['name'],
                'type' => 'asset',
            ]);
        }

        $validated['account_id'] = $sachkonto->id;
        $account = BankAccount::create($validated);

        return response()->json($account->load('account'), 201);
    }

    /**
     * Display the specified bank account
     */
    public function show(int $id): JsonResponse
    {
        $account = BankAccount::findOrFail($id);
        
        $data = $account->toArray();
        $data['balance_formatted'] = $account->balance_formatted;
        $data['formatted_iban'] = $account->formatted_iban;

        return response()->json($data);
    }

    /**
     * Update the specified bank account
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $account = BankAccount::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'bank_name' => 'required|string|max:255',
            'iban' => 'required|string|max:34|unique:bank_accounts,iban,' . $id,
            'bic' => 'nullable|string|max:11',
            'account_number' => 'nullable|string|max:50',
            'bank_code' => 'nullable|string|max:8',
            'currency' => 'nullable|in:EUR,USD,GBP,CHF',
            'type' => 'nullable|in:checking,savings,credit_card',
            'is_default' => 'nullable|boolean',
            'notes' => 'nullable|string',
        ]);

        $account->update($validated);

        return response()->json($account);
    }

    /**
     * Remove the specified bank account
     */
    public function destroy(int $id): JsonResponse
    {
        $account = BankAccount::findOrFail($id);

        // Prevent deletion if it's the default account and there are other accounts
        if ($account->is_default && BankAccount::count() > 1) {
            return response()->json([
                'error' => 'Sie können das Standard-Bankkonto nicht löschen. Bitte legen Sie zuerst ein anderes Konto als Standard fest.'
            ], 400);
        }

        $account->delete();

        return response()->json(['message' => 'Bankkonto erfolgreich gelöscht']);
    }

    /**
     * Set a bank account as default
     */
    public function setDefault(int $id): JsonResponse
    {
        $account = BankAccount::findOrFail($id);
        $account->is_default = true;
        $account->save();

        return response()->json($account);
    }
}
