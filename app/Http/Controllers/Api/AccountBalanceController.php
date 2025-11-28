<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Accounting\Models\Account;
use Illuminate\Http\JsonResponse;

class AccountBalanceController extends Controller
{
    /**
     * Get all accounts with their current balances
     */
    public function index(): JsonResponse
    {
        $accounts = Account::with('journalEntryLines')->get();
        
        $accountsWithBalances = $accounts->map(function ($account) {
            $balance = $this->calculateBalance($account);
            
            return [
                'id' => $account->id,
                'code' => $account->code,
                'name' => $account->name,
                'type' => $account->type,
                'balance' => $balance,
                'balance_formatted' => $this->formatCurrency($balance),
            ];
        });
        
        return response()->json($accountsWithBalances);
    }
    
    /**
     * Get balance for a specific account
     */
    public function show(Account $account): JsonResponse
    {
        $balance = $this->calculateBalance($account);
        
        return response()->json([
            'id' => $account->id,
            'code' => $account->code,
            'name' => $account->name,
            'type' => $account->type,
            'balance' => $balance,
            'balance_formatted' => $this->formatCurrency($balance),
        ]);
    }
    
    /**
     * Calculate account balance from journal entry lines
     * 
     * Logic:
     * - Asset/Expense: Debit increases, Credit decreases (Balance = Debit - Credit)
     * - Liability/Equity/Revenue: Credit increases, Debit decreases (Balance = Credit - Debit)
     */
    private function calculateBalance(Account $account): int
    {
        $debitSum = $account->journalEntryLines()
            ->where('type', 'debit')
            ->sum('amount');
            
        $creditSum = $account->journalEntryLines()
            ->where('type', 'credit')
            ->sum('amount');
        
        // For asset and expense accounts: Debit - Credit
        // For liability, equity, and revenue accounts: Credit - Debit
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
