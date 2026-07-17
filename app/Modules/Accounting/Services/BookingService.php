<?php

namespace App\Modules\Accounting\Services;

use App\Models\CompanySetting;
use App\Modules\Accounting\Models\AuditLog;
use App\Modules\Accounting\Models\JournalEntry;
use App\Services\NumberSequenceService;
use Carbon\Carbon;
use DomainException;
use Exception;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BookingService
{
    public function __construct(
        private ?NumberSequenceService $numberSequenceService = null
    ) {
        // Optionaler Konstruktor-Parameter (statt Pflicht-Injection): BookingService
        // wird an mehreren Stellen per `new BookingService` außerhalb des Containers
        // instanziiert (DemoTenantSeeder, TenantTestDataFactory) - das bleibt gültig.
        $this->numberSequenceService ??= new NumberSequenceService;
    }

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
            // 0. SPEC-05 (Teil B): Erfassungssperre - kein NEUER Buchungsentwurf mit
            // Datum in einer bereits festgeschriebenen Periode. Gilt für jeden Aufrufer
            // (manuelle Buchung, Rechnungs-/Belegbuchung), da alle über createBooking()
            // laufen. Das Festschreiben BESTEHENDER Drafts (lockBooking(), auch aus
            // lockPeriod() selbst) ist davon bewusst NICHT betroffen.
            $this->assertPeriodOpen((string) $data['date']);

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
                'batch_id' => (string) Str::uuid(),
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
     * SPEC-05 (Teil A): vergibt dabei die lückenlose journal_number (year=0,
     * jahresunabhängig fortlaufend) - erst hier, nicht bei createBooking(), damit
     * verworfene Drafts keine Lücke in der Journalnummer-Folge hinterlassen.
     *
     * SPEC-05 (Teil B): bewusst KEINE Prüfung gegen books_locked_until hier -
     * lockPeriod() muss bestehende Drafts INNERHALB der gesperrten Periode
     * festschreiben können (das ist ja gerade sein Zweck), und ein manuelles
     * Festschreiben eines älteren Drafts über die UI muss ebenfalls möglich
     * bleiben. Die Erfassungssperre gilt nur für NEUE Buchungen (createBooking()).
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

        // SPEC-06: alter Status VOR dem Update sichern - getOriginal() wäre
        // nach update() bereits auf die neuen Werte synchronisiert.
        $oldStatus = $entry->status;

        $entry->update([
            'status' => 'posted',
            'locked_at' => Carbon::now(),
            'journal_number' => $this->numberSequenceService->next('journal', 0),
        ]);

        // SPEC-06: fachlicher Event, explizit aus dem Service gefeuert (siehe
        // AuditObserver::isServiceManaged() - der generische 'updated'-Eintrag
        // für genau diesen Übergang wird dort unterdrückt, damit hier GENAU
        // EIN Eintrag entsteht).
        AuditLog::record(
            $entry,
            'locked',
            ['status' => $oldStatus, 'locked_at' => null],
            [
                'status' => $entry->status,
                'locked_at' => $entry->locked_at?->toIso8601String(),
                'journal_number' => $entry->journal_number,
            ]
        );

        return $entry;
    }

    /**
     * SPEC-05 (Teil B): Periodenfestschreibung (Monatsabschluss). Schreibt alle
     * Draft-Buchungen des Tenants bis (inklusive) $untilDate fest, vergibt dabei
     * lückenlos journal_number in Datums-/ID-Reihenfolge (natürliche Verzahnung
     * mit Teil A über lockBooking()) und setzt anschließend
     * company_settings.books_locked_until.
     *
     * @return int Anzahl der festgeschriebenen Buchungen.
     *
     * @throws DomainException wenn $untilDate nicht monoton nach dem bisherigen
     *                         books_locked_until liegt, oder ohne Mandanten-Kontext.
     */
    public function lockPeriod(Carbon $untilDate): int
    {
        return DB::transaction(function () use ($untilDate) {
            $tenant = tenant();
            if (! $tenant) {
                throw new DomainException('Periodenfestschreibung erfordert einen Mandanten-Kontext.');
            }

            // lockForUpdate: verhindert, dass zwei gleichzeitige lockPeriod()-Aufrufe
            // desselben Tenants den Monoton-Guard gegeneinander umgehen (TOCTOU).
            $settings = CompanySetting::where('tenant_id', $tenant->id)->lockForUpdate()->first();
            if (! $settings) {
                throw new DomainException('Firmeneinstellungen für diesen Mandanten nicht gefunden.');
            }

            $currentLockedUntil = $settings->books_locked_until
                ? Carbon::parse($settings->books_locked_until)->startOfDay()
                : null;
            $untilDateNormalized = $untilDate->copy()->startOfDay();

            if ($currentLockedUntil && $untilDateNormalized->lte($currentLockedUntil)) {
                throw new DomainException('Zeitraum ist bereits festgeschrieben.');
            }

            $drafts = JournalEntry::where('tenant_id', $tenant->id)
                ->where('status', 'draft')
                ->whereDate('booking_date', '<=', $untilDateNormalized->toDateString())
                ->orderBy('booking_date')
                ->orderBy('id')
                ->get();

            $count = 0;
            foreach ($drafts as $draft) {
                $this->lockBooking($draft->id);
                $count++;
            }

            $settings->update(['books_locked_until' => $untilDateNormalized->toDateString()]);

            // SPEC-06: EIN zusammenfassender Eintrag am CompanySetting - die
            // einzelnen Buchungen bekommen bereits je einen eigenen
            // 'locked'-Eintrag über lockBooking() oben (kein doppeltes
            // Protokollieren pro Buchung nötig).
            AuditLog::record(
                $settings,
                'period_locked',
                ['books_locked_until' => $currentLockedUntil?->toDateString()],
                ['books_locked_until' => $untilDateNormalized->toDateString(), 'locked_count' => $count]
            );

            return $count;
        });
    }

    /**
     * SPEC-05 (Teil B): wirft eine DomainException, wenn $date in einer bereits
     * festgeschriebenen Periode liegt (booking_date <= books_locked_until).
     * Öffentlich, damit Aufrufer, die VOR createBooking() bereits aufwendige
     * Vorarbeit leisten (z.B. InvoiceBookingService::assertBookable() vor dem
     * Aufbau der Buchungszeilen, BelegController::book() vor der Kontenauflösung),
     * früh und mit klarer Fehlermeldung abbrechen können. createBooking() ruft
     * diese Methode ohnehin selbst auf - doppelte Absicherung, kein Umgehen möglich.
     *
     * @throws DomainException
     */
    public function assertPeriodOpen(string $date): void
    {
        $lockedUntil = $this->currentLockedUntilDate();
        if (! $lockedUntil) {
            return;
        }

        if (Carbon::parse($date)->startOfDay()->lte($lockedUntil)) {
            throw new DomainException(sprintf(
                'Der Zeitraum bis %s ist festgeschrieben – Buchung im offenen Zeitraum erfassen.',
                $lockedUntil->format('d.m.Y')
            ));
        }
    }

    /**
     * Liefert books_locked_until des aktuellen Mandanten oder null (keine Sperre /
     * kein Mandanten-Kontext, z.B. in Jobs/Commands ohne explizit gesetzten Tenant -
     * dort greift auch der BelongsToTenant-Scope nicht, siehe CLAUDE.md Regel 6).
     */
    private function currentLockedUntilDate(): ?Carbon
    {
        $tenant = tenant();
        if (! $tenant) {
            return null;
        }

        $settings = CompanySetting::where('tenant_id', $tenant->id)->first();
        if (! $settings || ! $settings->books_locked_until) {
            return null;
        }

        return Carbon::parse($settings->books_locked_until)->startOfDay();
    }

    /**
     * Reverse a booking (Generalumkehr/Storno).
     *
     * SPEC-05 (Teil B) Storno-Sonderfall: Ein Storno auf eine Buchung in einer
     * bereits festgeschriebenen Periode ist erlaubt (GoBD-konform - die Sperre
     * betrifft nur NEUE Erfassung, siehe assertPeriodOpen()), aber die
     * Storno-Buchung selbst bekommt als booking_date max(Originaldatum, erster
     * offener Tag nach books_locked_until) - wie in DATEV wird im offenen
     * Zeitraum storniert, die gesperrte Periode bleibt unangetastet. Das
     * Originaldatum wird stattdessen im Beschreibungstext genannt.
     *
     * SPEC-05 (Teil A): die Storno-Buchung bekommt eine eigene, neue
     * journal_number (nicht die des Originals).
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

            $originalDate = Carbon::parse($original->booking_date)->startOfDay();
            $lockedUntil = $this->currentLockedUntilDate();
            $firstOpenDay = $lockedUntil ? $lockedUntil->copy()->addDay() : null;
            $reversalDate = $firstOpenDay && $originalDate->lte($firstOpenDay)
                ? $firstOpenDay
                : $originalDate;

            // Create Reversal Header (journal_number/public_id werden NICHT übernommen -
            // die Storno-Buchung braucht eine eigene, neue Nummer/ID, siehe Docblock oben
            // bzw. HasPublicId::bootHasPublicId()).
            $reversal = $original->replicate(['journal_number']);
            $reversal->batch_id = (string) Str::uuid();
            $reversal->booking_date = $reversalDate;
            $reversal->description = sprintf(
                'Storno zu Buchung vom %s: %s',
                $originalDate->format('d.m.Y'),
                $original->description
            );
            $reversal->status = 'posted'; // Reversals are immediately effective
            $reversal->locked_at = Carbon::now();
            $reversal->journal_number = $this->numberSequenceService->next('journal', 0);
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
            $oldOriginalStatus = $original->status;
            $original->status = 'cancelled';
            $original->save();

            // SPEC-06: fachlicher Event am ORIGINAL (die Storno-Buchung selbst
            // bekommt bereits automatisch einen 'created'-Eintrag über den
            // AuditObserver, siehe $reversal->push() oben - kein weiterer
            // expliziter Aufruf hier nötig).
            AuditLog::record(
                $original,
                'reversed',
                ['status' => $oldOriginalStatus],
                ['status' => $original->status, 'reversal_journal_entry_public_id' => $reversal->public_id]
            );

            return $reversal;
        });
    }
}
