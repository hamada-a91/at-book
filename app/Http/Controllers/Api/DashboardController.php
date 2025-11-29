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
     * Get chart data for income vs expenses
     */
    public function chart(Request $request): JsonResponse
    {
        $startDate = $request->input('start_date', now()->startOfMonth()->toDateString());
        $endDate = $request->input('end_date', now()->endOfMonth()->toDateString());
        $groupBy = $request->input('group_by', 'day'); // 'day' or 'month'

        $dateFormat = $groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
        $phpDateFormat = $groupBy === 'month' ? 'Y-m' : 'Y-m-d';

        // Use raw SQL for efficient aggregation
        // Note: SQLite uses strftime, MySQL uses DATE_FORMAT. Assuming MySQL/MariaDB for production but check local env.
        // User is on WSL/Ubuntu, likely MySQL or SQLite. Laravel projects usually default to MySQL.
        // Let's use a collection-based approach to be DB-agnostic if performance allows, or try to detect driver.
        // For robustness in this environment, let's fetch relevant lines and aggregate in PHP.
        
        $entries = JournalEntry::with(['lines.account'])
            ->where('status', 'posted')
            ->whereBetween('booking_date', [$startDate, $endDate])
            ->orderBy('booking_date')
            ->get();

        $data = [];

        foreach ($entries as $entry) {
            $date = \Carbon\Carbon::parse($entry->booking_date)->format($phpDateFormat);
            
            if (!isset($data[$date])) {
                $data[$date] = ['date' => $date, 'income' => 0, 'expense' => 0];
            }

            foreach ($entry->lines as $line) {
                if (!$line->account) continue;

                if ($line->account->type === 'revenue') {
                    if ($line->type === 'credit') {
                        $data[$date]['income'] += $line->amount;
                    } else {
                        $data[$date]['income'] -= $line->amount;
                    }
                } elseif ($line->account->type === 'expense') {
                    if ($line->type === 'debit') {
                        $data[$date]['expense'] += $line->amount;
                    } else {
                        $data[$date]['expense'] -= $line->amount;
                    }
                }
            }
        }

        // Fill missing dates if needed, but for now just return what we have
        // Sort by date
        ksort($data);

        // Convert to array and format amounts
        $chartData = array_values(array_map(function ($item) {
            return [
                'name' => $item['date'],
                'income' => round($item['income'] / 100, 2),
                'expense' => round($item['expense'] / 100, 2),
            ];
        }, $data));

        return response()->json($chartData);
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
