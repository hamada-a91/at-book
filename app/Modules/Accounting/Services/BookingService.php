<?php

namespace App\Modules\Accounting\Services;

use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Models\JournalEntryLine;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Exception;
use Carbon\Carbon;

class BookingService
{
    /**
     * Create a new booking batch (Draft).
     * 
     * @param array $data
     * @return JournalEntry
     * @throws Exception
     */
    public function createBooking(array $data): JournalEntry
    {
        return DB::transaction(function () use ($data) {
            // 1. Validate Balance (Soll = Haben)
            $debitSum = collect($data['lines'])->where('type', 'debit')->sum('amount');
            $creditSum = collect($data['lines'])->where('type', 'credit')->sum('amount');

            if ($debitSum !== $creditSum) {
                throw new Exception("Booking is not balanced. Debit: $debitSum, Credit: $creditSum");
            }

            // 2. Create Header
            $entry = JournalEntry::create([
                'batch_id' => (string) \Illuminate\Support\Str::uuid(),
                'booking_date' => $data['date'],
                'description' => $data['description'],
                'contact_id' => $data['contact_id'] ?? null,
                'beleg_id' => $data['beleg_id'] ?? null,
                'status' => 'draft',
                'user_id' => Auth::id() ?? 1, // Fallback for demo
            ]);

            // 3. Create Lines
            foreach ($data['lines'] as $line) {
                $entry->lines()->create([
                    'account_id' => $line['account_id'],
                    'type' => $line['type'],
                    'amount' => $line['amount'],
                    'tax_key' => $line['tax_key'] ?? null,
                    'tax_amount' => $line['tax_amount'] ?? 0,
                ]);
            }

            // 4. Update Beleg status if linked
            if (!empty($data['beleg_id'])) {
                $beleg = \App\Models\Beleg::find($data['beleg_id']);
                if ($beleg && $beleg->status === 'draft') {
                    $beleg->update(['status' => 'booked']);
                }
            }

            return $entry;
        });
    }

    /**
     * GoBD: Lock a booking to make it immutable.
     * Once locked, it cannot be edited, only reversed (storniert).
     * 
     * @param int $journalEntryId
     * @return JournalEntry
     * @throws Exception
     */
    public function lockBooking(int $journalEntryId): JournalEntry
    {
        $entry = JournalEntry::findOrFail($journalEntryId);

        if ($entry->locked_at) {
            throw new Exception("Booking is already locked/posted.");
        }

        // In a real system, we might assign a sequential 'Journal Number' here
        // which must be gapless (Lückenlos).
        
        $entry->update([
            'status' => 'posted',
            'locked_at' => Carbon::now(),
        ]);

        // Trigger audit log (handled by observer usually, but explicit here for clarity)
        // AuditLog::log($entry, 'lock');

        return $entry;
    }

    /**
     * Reverse a booking (Generalumkehr/Storno).
     */
    public function reverseBooking(int $journalEntryId): JournalEntry
    {
        return DB::transaction(function () use ($journalEntryId) {
            $original = JournalEntry::with('lines')->findOrFail($journalEntryId);
            
            if (!$original->locked_at) {
                throw new Exception("Drafts can be deleted. Only locked bookings need reversal.");
            }

            // Check if already cancelled
            if ($original->status === 'cancelled') {
                throw new Exception("This booking has already been reversed.");
            }

            // Create Reversal Header
            $reversal = $original->replicate();
            $reversal->batch_id = (string) \Illuminate\Support\Str::uuid();
            $reversal->description = "Storno: " . $original->description;
            $reversal->status = 'posted'; // Reversals are immediately effective
            $reversal->locked_at = Carbon::now();
            $reversal->push();

            // Create Reversal Lines (Swap Debit/Credit)
            foreach ($original->lines as $line) {
                $reversal->lines()->create([
                    'account_id' => $line->account_id,
                    'type' => $line->type === 'debit' ? 'credit' : 'debit', // Swap
                    'amount' => $line->amount,
                    'tax_key' => $line->tax_key,
                    'tax_amount' => $line->tax_amount,
                ]);
            }

            // Mark original as cancelled (GoBD: can't delete, must reverse)
            $original->status = 'cancelled';
            $original->save();

            return $reversal;
        });
    }
}
