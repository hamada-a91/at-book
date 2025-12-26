<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\HasTenantScope;
use App\Modules\Accounting\Models\Account;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    use HasTenantScope;

    /**
     * List all accounts (Chart of Accounts) with balances
     */
    public function index(): JsonResponse
    {
        // Get tenant and explicitly filter accounts
        $tenant = $this->getTenantOrFail();
        
        $accounts = Account::where('tenant_id', $tenant->id)
            ->with('journalEntryLines')
            ->orderBy('id', 'desc')
            ->get();
        
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
        $tenant = $this->getTenantOrFail();
        
        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:10',
                \Illuminate\Validation\Rule::unique('accounts', 'code')->where('tenant_id', $tenant->id),
            ],
            'name' => 'required|string|max:255',
            'type' => 'required|in:asset,liability,equity,revenue,expense',
            'tax_key_code' => 'nullable|string',
        ]);

        $account = Account::create($validated);

        return response()->json($account, 201);
    }

    /**
     * Display the specified account with transaction history
     */
    public function show(Request $request, int $id): JsonResponse
    {
        // Ensure tenant is loaded
        $tenant = $this->getTenantOrFail();
        
        $account = Account::where('tenant_id', $tenant->id)->findOrFail($id);
        
        // Get date range from request or use defaults
        $fromDate = $request->input('from_date');
        $toDate = $request->input('to_date');
        
        // Get all journal entry lines for this account
        $query = $account->journalEntryLines()
            ->with(['journalEntry' => function($q) {
                $q->with('contact');
            }])
            ->join('journal_entries', 'journal_entry_lines.journal_entry_id', '=', 'journal_entries.id')
            ->select('journal_entry_lines.*', 'journal_entries.booking_date')
            ->orderBy('journal_entries.booking_date', 'asc')
            ->orderBy('journal_entry_lines.id', 'asc');
        
        if ($fromDate) {
            $query->where('journal_entries.booking_date', '>=', $fromDate);
        }
        
        if ($toDate) {
            $query->where('journal_entries.booking_date', '<=', $toDate);
        }
        
        $lines = $query->get();
        
        // Calculate running balance and format transactions
        $runningBalance = 0;
        $totalDebit = 0;
        $totalCredit = 0;
        
        $transactions = $lines->map(function ($line) use (&$runningBalance, &$totalDebit, &$totalCredit, $account) {
            $debit = $line->type === 'debit' ? $line->amount : 0;
            $credit = $line->type === 'credit' ? $line->amount : 0;
            
            $totalDebit += $debit;
            $totalCredit += $credit;
            
            // Calculate running balance based on account type
            if (in_array($account->type, ['asset', 'expense'])) {
                $runningBalance += ($debit - $credit);
            } else {
                $runningBalance += ($credit - $debit);
            }
            
            return [
                'id' => $line->id,
                'date' => $line->journalEntry->booking_date,
                'description' => $line->journalEntry->description,
                'reference' => $line->journalEntry->reference_number,
                'contact' => $line->journalEntry->contact ? $line->journalEntry->contact->name : null,
                'debit' => $debit,
                'credit' => $credit,
                'balance' => $runningBalance,
            ];
        });
        
        return response()->json([
            'account' => $account,
            'transactions' => $transactions,
            'summary' => [
                'total_debit' => $totalDebit,
                'total_credit' => $totalCredit,
                'current_balance' => $runningBalance,
            ],
            'period' => [
                'from' => $fromDate,
                'to' => $toDate,
            ],
        ]);
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
