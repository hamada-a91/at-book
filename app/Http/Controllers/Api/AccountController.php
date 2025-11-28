<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Accounting\Models\Account;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    /**
     * List all accounts (Chart of Accounts) with balances
     */
    public function index(): JsonResponse
    {
        $accounts = Account::with('journalEntryLines')->orderBy('code')->get();
        
        $accountsWithBalances = $accounts->map(function ($account) {
            $data = $account->toArray();
            $data['balance'] = $this->calculateBalance($account);
            $data['balance_formatted'] = $this->formatCurrency($data['balance']);
            return $data;
        });
        
        return response()->json($accountsWithBalances);
    }

    /**
     * Store a newly created account in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|unique:accounts,code|max:10',
            'name' => 'required|string|max:255',
            'type' => 'required|in:asset,liability,equity,revenue,expense',
            'tax_key_code' => 'nullable|string',
        ]);

        $account = Account::create($validated);

        return response()->json($account, 201);
    }
    
    /**
     * Calculate balance for an account
     */
    private function calculateBalance($account): int
    {
        $debitSum = $account->journalEntryLines()
            ->where('type', 'debit')
            ->sum('amount');
            
        $creditSum = $account->journalEntryLines()
            ->where('type', 'credit')
            ->sum('amount');
        
        // Asset/Expense: Debit - Credit
        // Liability/Equity/Revenue: Credit - Debit
        if (in_array($account->type, ['asset', 'expense'])) {
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
