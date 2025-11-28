<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\JournalEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Get dashboard summary with income, expenses, and profit
     */
    public function summary(Request $request): JsonResponse
    {
        // Get date range (default: current month)
        $startDate = $request->input('start_date', now()->startOfMonth()->toDateString());
        $endDate = $request->input('end_date', now()->endOfMonth()->toDateString());
        
        // Calculate income (revenue accounts: 8000-8999)
        $income = $this->calculateAccountTypeTotal('revenue', $startDate, $endDate);
        
        // Calculate expenses (expense accounts: 4000-6999)
        $expenses = $this->calculateAccountTypeTotal('expense', $startDate, $endDate);
        
        // Calculate profit
        $profit = $income - $expenses;
        
        return response()->json([
            'income' => $income,
            'income_formatted' => $this->formatCurrency($income),
            'expenses' => $expenses,
            'expenses_formatted' => $this->formatCurrency($expenses),
            'profit' => $profit,
            'profit_formatted' => $this->formatCurrency($profit),
            'period' => [
                'start' => $startDate,
                'end' => $endDate,
            ],
        ]);
    }
    
    /**
     * Get recent bookings
     */
    public function recentBookings(Request $request): JsonResponse
    {
        $limit = $request->input('limit', 10);
        
        $bookings = JournalEntry::with(['contact', 'lines.account'])
            ->where('status', 'posted')
            ->orderBy('booking_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
        
        return response()->json($bookings);
    }
    
    /**
     * Calculate total for account type within date range
     */
    private function calculateAccountTypeTotal(string $type, string $startDate, string $endDate): int
    {
        $accounts = Account::where('type', $type)->get();
        $total = 0;
        
        foreach ($accounts as $account) {
            // Get all journal entry lines for this account within date range
            $debitSum = $account->journalEntryLines()
                ->whereHas('journalEntry', function ($query) use ($startDate, $endDate) {
                    $query->where('status', 'posted')
                        ->whereBetween('booking_date', [$startDate, $endDate]);
                })
                ->where('type', 'debit')
                ->sum('amount');
                
            $creditSum = $account->journalEntryLines()
                ->whereHas('journalEntry', function ($query) use ($startDate, $endDate) {
                    $query->where('status', 'posted')
                        ->whereBetween('booking_date', [$startDate, $endDate]);
                })
                ->where('type', 'credit')
                ->sum('amount');
            
            // For revenue: credits increase income
            // For expense: debits increase expenses
            if ($type === 'revenue') {
                $total += ($creditSum - $debitSum);
            } else {
                $total += ($debitSum - $creditSum);
            }
        }
        
        return $total;
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
