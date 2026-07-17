<?php

namespace App\Modules\Accounting\Services;

use App\Modules\Accounting\Models\JournalEntry;
use Carbon\Carbon;
use Exception;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class BookingService
{
    /**
     * Create a new booking batch (Draft).
     *
     * @param  int|null  $userId  Expliziter Buchungsbenutzer für Aufrufe außerhalb eines
     *                            HTTP-Requests (Jobs/Commands), wo Auth::id() nicht greift.
     *                            Ist keiner der beiden vorhanden -> Exception (SPEC-04 4.3:
     *                            der bisherige "?? 1"-Demo-Fallback ist entfernt, damit
     *                            Buchungen nie einem falschen/geratenen Benutzer zugeordnet
     *                            werden).
     * @param  bool  $autoLock  Wenn true, wird die Buchung im selben Aufruf sofort per
     *                          lockBooking() festgeschrieben (GoBD).
     *
     * @throws Exception
     */
    public function createBooking(array $data, ?int $userId = null, bool $autoLock = false): JournalEntry
    {
        return DB::transaction(function () use ($data, $userId, $autoLock) {
            // 1. Validate Balance (Soll = Haben) - als Integer-Cents casten, bevor verglichen wird.
            $debitSum = (int) collect($data['lines'])->where('type', 'debit')->sum('amount');
            $creditSum = (int) collect($data['lines'])->where('type', 'credit')->sum('amount');

            if ($debitSum !== $creditSum) {
                throw new Exception("Booking is not balanced. Debit: $debitSum, Credit: $creditSum");
            }

            $resolvedUserId = $userId ?? Auth::id();
            if (! $resolvedUserId) {
                throw new Exception('Buchung erfordert einen angemeldeten Benutzer oder einen explizit übergebenen userId-Parameter (z.B. für Jobs).');
            }

            // 2. Create Header
            $entry = JournalEntry::create([
                'batch_id' => (string) \Illuminate\Support\Str::uuid(),
                'booking_date' => $data['date'],
                'description' => $data['description'],
                'contact_id' => $data['contact_id'] ?? null,
                'beleg_id' => $data['beleg_id'] ?? null,
                'status' => 'draft',
                'user_id' => $resolvedUserId,
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
            if (! empty($data['beleg_id'])) {
                $beleg = \App\Models\Beleg::find($data['beleg_id']);
                if ($beleg && $beleg->status === 'draft') {
                    $beleg->update(['status' => 'booked']);
                }
            }

            // 5. Optional: sofort festschreiben (GoBD)
            if ($autoLock) {
                $entry = $this->lockBooking($entry->id);
            }

            return $entry;
        });
    }

    /**
     * GoBD: Lock a booking to make it immutable.
     * Once locked, it cannot be edited, only reversed (storniert).
     *
     * @throws Exception
     */
    public function lockBooking(int $journalEntryId): JournalEntry
    {
        // SPEC-03/3.3: findOrFail ohne explizites where('tenant_id', ...) ist hier
        // sicher, weil JournalEntry::BelongsToTenant einen Global Scope registriert,
        // der im HTTP-Kontext (tenant() gesetzt via SetTenantFromUser) automatisch
        // greift - eine fremde ID führt zu ModelNotFoundException (404), nicht zum
        // Zugriff auf einen anderen Mandanten. Wird diese Methode je aus einem Job/
        // einer Console-Command aufgerufen, MUSS der Aufrufer vorher
        // app()->instance('currentTenant', $tenant) setzen, sonst greift der Scope
        // nicht (siehe CLAUDE.md Regel 6).
        $entry = JournalEntry::findOrFail($journalEntryId);

        if ($entry->locked_at) {
            throw new Exception('Booking is already locked/posted.');
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
            // SPEC-03/3.3: Wie in lockBooking() oben - Global Scope aus BelongsToTenant
            // schützt findOrFail() im HTTP-Kontext bereits vor Fremd-Tenant-Zugriff.
            $original = JournalEntry::with('lines')->findOrFail($journalEntryId);

            if (! $original->locked_at) {
                throw new Exception('Drafts can be deleted. Only locked bookings need reversal.');
            }

            // Check if already cancelled
            if ($original->status === 'cancelled') {
                throw new Exception('This booking has already been reversed.');
            }

            // Create Reversal Header
            $reversal = $original->replicate();
            $reversal->batch_id = (string) \Illuminate\Support\Str::uuid();
            $reversal->description = 'Storno: '.$original->description;
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
