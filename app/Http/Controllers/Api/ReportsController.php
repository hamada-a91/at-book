<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Models\JournalEntryLine;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReportsController extends Controller
{
    /**
     * Generate Trial Balance (Summen- und Saldenliste)
     */
    public function trialBalance(Request $request): JsonResponse
    {
        $fromDate = $request->input('from_date', Carbon::now()->startOfYear()->toDateString());
        $toDate = $request->input('to_date', Carbon::now()->endOfYear()->toDateString());

        $accounts = Account::with(['journalEntryLines' => function ($query) use ($fromDate, $toDate) {
            $query->whereHas('journalEntry', function ($q) use ($fromDate, $toDate) {
                $q->whereBetween('booking_date', [$fromDate, $toDate])
                  ->where('status', '!=', 'cancelled');
            });
        }])->get();

        $reportData = $accounts->map(function ($account) {
            $debitSum = $account->journalEntryLines->where('type', 'debit')->sum('amount');
            $creditSum = $account->journalEntryLines->where('type', 'credit')->sum('amount');
            $balance = $debitSum - $creditSum;

            // Skip accounts with no movement if requested
            if ($debitSum === 0 && $creditSum === 0) {
                return null;
            }

            return [
                'account_id' => $account->id,
                'code' => $account->code,
                'name' => $account->name,
                'type' => $account->type,
                'total_debit' => $debitSum,
                'total_credit' => $creditSum,
                'balance' => $balance,
            ];
        })->filter()->values();

        return response()->json([
            'period' => ['from' => $fromDate, 'to' => $toDate],
            'data' => $reportData,
            'totals' => [
                'debit' => $reportData->sum('total_debit'),
                'credit' => $reportData->sum('total_credit'),
            ]
        ]);
    }

    /**
     * Generate Profit & Loss Statement (Gewinn- und Verlustrechnung)
     */
    public function profitAndLoss(Request $request): JsonResponse
    {
        $fromDate = $request->input('from_date', Carbon::now()->startOfYear()->toDateString());
        $toDate = $request->input('to_date', Carbon::now()->endOfYear()->toDateString());

        // Get Revenue Accounts (Erlöse)
        $revenueAccounts = Account::where('type', 'revenue')
            ->with(['journalEntryLines' => function ($query) use ($fromDate, $toDate) {
                $query->whereHas('journalEntry', function ($q) use ($fromDate, $toDate) {
                    $q->whereBetween('booking_date', [$fromDate, $toDate])
                      ->where('status', '!=', 'cancelled');
                });
            }])->get();

        // Get Expense Accounts (Aufwand)
        $expenseAccounts = Account::where('type', 'expense')
            ->with(['journalEntryLines' => function ($query) use ($fromDate, $toDate) {
                $query->whereHas('journalEntry', function ($q) use ($fromDate, $toDate) {
                    $q->whereBetween('booking_date', [$fromDate, $toDate])
                      ->where('status', '!=', 'cancelled');
                });
            }])->get();

        $processAccounts = function ($accounts) {
            return $accounts->map(function ($account) {
                $debit = $account->journalEntryLines->where('type', 'debit')->sum('amount');
                $credit = $account->journalEntryLines->where('type', 'credit')->sum('amount');
                // For P&L: Revenue is Credit - Debit, Expense is Debit - Credit usually, 
                // but let's keep it simple: Balance = Credit - Debit (Revenue positive, Expense negative if normal balance)
                // Or standard: Revenue (Credit balance), Expense (Debit balance)
                
                $balance = $credit - $debit; // Positive for Revenue, Negative for Expense usually

                if ($debit === 0 && $credit === 0) return null;

                return [
                    'code' => $account->code,
                    'name' => $account->name,
                    'amount' => abs($balance), // Show absolute value
                    'balance_type' => $balance >= 0 ? 'credit' : 'debit'
                ];
            })->filter()->values();
        };

        $revenues = $processAccounts($revenueAccounts);
        $expenses = $processAccounts($expenseAccounts);

        $totalRevenue = $revenueAccounts->sum(function ($acc) {
            return $acc->journalEntryLines->where('type', 'credit')->sum('amount') - 
                   $acc->journalEntryLines->where('type', 'debit')->sum('amount');
        });

        $totalExpense = $expenseAccounts->sum(function ($acc) {
            return $acc->journalEntryLines->where('type', 'debit')->sum('amount') - 
                   $acc->journalEntryLines->where('type', 'credit')->sum('amount');
        });

        $netProfit = $totalRevenue - $totalExpense;

        return response()->json([
            'period' => ['from' => $fromDate, 'to' => $toDate],
            'revenues' => $revenues,
            'expenses' => $expenses,
            'total_revenue' => $totalRevenue,
            'total_expense' => $totalExpense,
            'net_profit' => $netProfit
        ]);
    }

    /**
     * Generate Balance Sheet (Bilanz)
     * WITH AGGREGATION: Debtor/Creditor accounts aggregated to 1400/1600
     */
    public function balanceSheet(Request $request): JsonResponse
    {
        $date = $request->input('to_date', Carbon::now()->endOfYear()->toDateString());

        // ===== ASSETS: Process aggregation =====
        // Get regular asset accounts (EXCLUDE 10000-19999 - those are individual debtors)
        $regularAssets = Account::where('type', 'asset')
            ->where(function($q) {
                $q->where('code', '<', '10000')->orWhere('code', '>=', '20000');
            })
            ->with(['journalEntryLines' => function ($query) use ($date) {
                $query->whereHas('journalEntry', function ($q) use ($date) {
                    $q->where('booking_date', '<=', $date)->where('status', '!=', 'cancelled');
                });
            }])->get();

        // AGGREGATE individual debtor accounts (10000-19999) to 1400
        $debtorAccounts = Account::whereBetween('code', ['10000', '19999'])
            ->with(['journalEntryLines' => function ($query) use ($date) {
                $query->whereHas('journalEntry', function ($q) use ($date) {
                    $q->where('booking_date', '<=', $date)->where('status', '!=', 'cancelled');
                });
            }])->get();

        $totalDebtors = $debtorAccounts->sum(function($acc) {
            $debit = $acc->journalEntryLines->where('type', 'debit')->sum('amount');
            $credit = $acc->journalEntryLines->where('type', 'credit')->sum('amount');
            return $debit - $credit;
        });

        $assets = collect();
        // Process regular assets
        foreach ($regularAssets as $account) {
            $debit = $account->journalEntryLines->where('type', 'debit')->sum('amount');
            $credit = $account->journalEntryLines->where('type', 'credit')->sum('amount');
            $balance = $debit - $credit;
            if ($balance != 0) {
                $assets->push([
                    'code' => $account->code,
                    'name' => $account->name,
                    'category' => $account->category,
                    'balance' => $balance,
                    'is_aggregated' => false
                ]);
            }
        }

        // Add aggregated debtors
        if ($totalDebtors != 0) {
            $assets->push([
                'code' => '1400',
                'name' => 'Forderungen aus Lieferungen und Leistungen',
                'category' => 'Umlaufvermögen',
                'balance' => $totalDebtors,
                'is_aggregated' => true,
                'detail_count' => $debtorAccounts->count()
            ]);
        }

        // ===== LIABILITIES: Process aggregation =====
        // Get regular liabilities (EXCLUDE 70000-79999 - those are individual creditors)
        $regularLiabilities = Account::where('type', 'liability')
            ->where(function($q) {
                $q->where('code', '<', '70000')->orWhere('code', '>=', '80000');
            })
            ->with(['journalEntryLines' => function ($query) use ($date) {
                $query->whereHas('journalEntry', function ($q) use ($date) {
                    $q->where('booking_date', '<=', $date)->where('status', '!=', 'cancelled');
                });
            }])->get();

        // AGGREGATE individual creditor accounts (70000-79999) to 1600
        $creditorAccounts = Account::whereBetween('code', ['70000', '79999'])
            ->with(['journalEntryLines' => function ($query) use ($date) {
                $query->whereHas('journalEntry', function ($q) use ($date) {
                    $q->where('booking_date', '<=', $date)->where('status', '!=', 'cancelled');
                });
            }])->get();

        $totalCreditors = $creditorAccounts->sum(function($acc) {
            $debit = $acc->journalEntryLines->where('type', 'debit')->sum('amount');
            $credit = $acc->journalEntryLines->where('type', 'credit')->sum('amount');
            return $credit - $debit;
        });

        $liabilities = collect();
        // Process regular liabilities
        foreach ($regularLiabilities as $account) {
            $debit = $account->journalEntryLines->where('type', 'debit')->sum('amount');
            $credit = $account->journalEntryLines->where('type', 'credit')->sum('amount');
            $balance = $credit - $debit;
            if ($balance != 0) {
                $liabilities->push([
                    'code' => $account->code,
                    'name' => $account->name,
                    'category' => $account->category,
                    'balance' => $balance,
                    'is_aggregated' => false
                ]);
            }
        }

        // Add aggregated creditors
        if ($totalCreditors != 0) {
            $liabilities->push([
                'code' => '1600',
                'name' => 'Verbindlichkeiten aus Lieferungen und Leistungen',
                'category' => 'Verbindlichkeiten',
                'balance' => $totalCreditors,
                'is_aggregated' => true,
                'detail_count' => $creditorAccounts->count()
            ]);
        }

        // ===== EQUITY =====
        $equityAccounts = Account::where('type', 'equity')
            ->with(['journalEntryLines' => function ($query) use ($date) {
                $query->whereHas('journalEntry', function ($q) use ($date) {
                    $q->where('booking_date', '<=', $date)->where('status', '!=', 'cancelled');
                });
            }])->get();

        $equity = collect();
        foreach ($equityAccounts as $account) {
            $debit = $account->journalEntryLines->where('type', 'debit')->sum('amount');
            $credit = $account->journalEntryLines->where('type', 'credit')->sum('amount');
            $balance = $credit - $debit;
            if ($balance != 0) {
                $equity->push([
                    'code' => $account->code,
                    'name' => $account->name,
                    'category' => $account->category,
                    'balance' => $balance,
                    'is_aggregated' => false
                ]);
            }
        }

        $totalAssets = $assets->sum('balance');
        $totalLiabilities = $liabilities->sum('balance');
        $totalEquity = $equity->sum('balance');
        $calculatedProfit = $totalAssets - ($totalLiabilities + $totalEquity);

        return response()->json([
            'as_of' => $date,
            'assets' => $assets,
            'liabilities' => $liabilities,
            'equity' => $equity,
            'total_assets' => $totalAssets,
            'total_liabilities' => $totalLiabilities,
            'total_equity' => $totalEquity,
            'calculated_profit_loss' => $calculatedProfit
        ]);
    }

    /**
     * Export Journal Entries
     */
    public function journalExport(Request $request): JsonResponse
    {
        $fromDate = $request->input('from_date', Carbon::now()->startOfYear()->toDateString());
        $toDate = $request->input('to_date', Carbon::now()->endOfYear()->toDateString());

        $entries = JournalEntry::with(['lines.account'])
            ->whereBetween('booking_date', [$fromDate, $toDate])
            ->where('status', '!=', 'cancelled')
            ->orderBy('booking_date')
            ->orderBy('id')
            ->get();

        return response()->json([
            'period' => ['from' => $fromDate, 'to' => $toDate],
            'entries' => $entries
        ]);
    }

    /**
     * Account Movements
     */
    public function accountMovements(Request $request): JsonResponse
    {
        $accountId = $request->input('account_id');
        $fromDate = $request->input('from_date', Carbon::now()->startOfYear()->toDateString());
        $toDate = $request->input('to_date', Carbon::now()->endOfYear()->toDateString());

        if (!$accountId) {
            return response()->json(['error' => 'Account ID required'], 400);
        }

        $account = Account::findOrFail($accountId);

        // Get opening balance (movements before from_date)
        $openingLines = JournalEntryLine::where('account_id', $accountId)
            ->whereHas('journalEntry', function ($q) use ($fromDate) {
                $q->where('booking_date', '<', $fromDate)
                  ->where('status', '!=', 'cancelled');
            })->get();
            
        $openingDebit = $openingLines->where('type', 'debit')->sum('amount');
        $openingCredit = $openingLines->where('type', 'credit')->sum('amount');
        
        // Determine normal balance side based on type
        $isAssetOrExpense = in_array($account->type, ['asset', 'expense']);
        $openingBalance = $isAssetOrExpense ? ($openingDebit - $openingCredit) : ($openingCredit - $openingDebit);

        // Get movements in period
        $movements = JournalEntryLine::where('account_id', $accountId)
            ->with('journalEntry')
            ->whereHas('journalEntry', function ($q) use ($fromDate, $toDate) {
                $q->whereBetween('booking_date', [$fromDate, $toDate])
                  ->where('status', '!=', 'cancelled');
            })
            ->get()
            ->sortBy(function($line) {
                return $line->journalEntry->booking_date . '-' . $line->journalEntry->id;
            })
            ->values();

        return response()->json([
            'account' => $account,
            'period' => ['from' => $fromDate, 'to' => $toDate],
            'opening_balance' => $openingBalance,
            'movements' => $movements,
            'closing_balance' => $openingBalance + (
                $isAssetOrExpense 
                ? ($movements->where('type', 'debit')->sum('amount') - $movements->where('type', 'credit')->sum('amount'))
                : ($movements->where('type', 'credit')->sum('amount') - $movements->where('type', 'debit')->sum('amount'))
            )
        ]);
    }

    /**
     * Tax Report (USt-Voranmeldung Helper)
     */
    public function taxReport(Request $request): JsonResponse
    {
        $fromDate = $request->input('from_date', Carbon::now()->startOfMonth()->toDateString());
        $toDate = $request->input('to_date', Carbon::now()->endOfMonth()->toDateString());

        // Find all lines with tax_key or tax_amount
        $taxLines = JournalEntryLine::where(function($q) {
                $q->whereNotNull('tax_key')->orWhere('tax_amount', '>', 0);
            })
            ->whereHas('journalEntry', function ($q) use ($fromDate, $toDate) {
                $q->whereBetween('booking_date', [$fromDate, $toDate])
                  ->where('status', '!=', 'cancelled');
            })
            ->with(['journalEntry', 'account'])
            ->get();

        // Group by tax key
        $grouped = $taxLines->groupBy('tax_key')->map(function ($lines, $key) {
            return [
                'tax_key' => $key,
                'base_amount' => $lines->sum('amount'),
                'tax_amount' => $lines->sum('tax_amount'),
                'count' => $lines->count()
            ];
        });

        // Calculate Input Tax (Vorsteuer) vs Output Tax (Umsatzsteuer)
        // This is a simplified logic. In a real app, you'd check account types or tax keys specifically.
        // Assuming '19' or '7' are output tax keys, and maybe 'V19' is input tax.
        // For now, let's just return the grouped data.

        return response()->json([
            'period' => ['from' => $fromDate, 'to' => $toDate],
            'tax_summary' => $grouped,
            'total_tax_amount' => $taxLines->sum('tax_amount')
        ]);
    }
}
