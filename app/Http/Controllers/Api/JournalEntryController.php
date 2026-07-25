<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\HasTenantScope;
use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Services\BookingService;
use App\Rules\TenantExists;
use Carbon\Carbon;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JournalEntryController extends Controller
{
    use HasTenantScope;

    public function __construct(
        private BookingService $bookingService
    ) {}

    /**
     * Create a new draft booking
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'description' => 'required|string|min:3',
            'contact_id' => ['nullable', new TenantExists('contacts')],
            'beleg_id' => ['nullable', new TenantExists('belege')],
            'lines' => 'required|array|min:2',
            'lines.*.account_id' => ['required', new TenantExists('accounts')],
            'lines.*.type' => 'required|in:debit,credit',
            'lines.*.amount' => 'required|integer|min:1',
            'lines.*.tax_key' => 'nullable|string',
            'lines.*.tax_amount' => 'nullable|integer',
            // SPEC-08 (Teil A): manuelle Buchungen können pro Zeile optional eine
            // Kostenstelle/einen Kostenträger tragen (kein Dokument-Default, da
            // manuelle Buchungen keinen project_id-Kopf haben).
            'lines.*.cost_center_id' => ['nullable', new TenantExists('cost_centers')],
            'lines.*.cost_object_id' => ['nullable', new TenantExists('cost_objects')],
        ]);

        try {
            $entry = $this->bookingService->createBooking($validated);

            return response()->json($entry->load('lines'), 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * Lock a booking (GoBD)
     */
    public function lock(int $id): JsonResponse
    {
        try {
            $entry = $this->bookingService->lockBooking($id);

            return response()->json($entry);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * Reverse a booking
     */
    public function reverse(int $id): JsonResponse
    {
        try {
            $reversal = $this->bookingService->reverseBooking($id);

            return response()->json($reversal->load('lines'), 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * List journal entries
     */
    public function index(Request $request): JsonResponse
    {
        $tenant = $this->getTenantOrFail();
        $query = \App\Modules\Accounting\Models\JournalEntry::where('tenant_id', $tenant->id)
            ->with(['lines.account', 'beleg'])
            ->orderBy('id', 'desc');

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhere('id', 'like', "%{$search}%");
            });
        }

        if ($request->filled('from_date')) {
            $query->whereDate('booking_date', '>=', $request->from_date);
        }

        if ($request->filled('to_date')) {
            $query->whereDate('booking_date', '<=', $request->to_date);
        }

        $entries = $query->paginate(50);

        return response()->json($entries);
    }

    /**
     * Show a single booking
     */
    public function show(int $id): JsonResponse
    {
        $entry = \App\Modules\Accounting\Models\JournalEntry::with(['lines.account', 'beleg'])
            ->findOrFail($id);

        return response()->json($entry);
    }

    /**
     * SPEC-05 (Teil B): Periodenfestschreibung (Monatsabschluss). Schreibt alle
     * Draft-Buchungen bis (inklusive) until_date fest. Nur owner/buchhalter
     * (siehe routes/api.php, role-Middleware).
     */
    public function lockPeriod(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'until_date' => 'required|date',
        ]);

        try {
            $lockedCount = $this->bookingService->lockPeriod(Carbon::parse($validated['until_date']));
        } catch (DomainException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $tenant = $this->getTenantOrFail();
        $settings = CompanySetting::where('tenant_id', $tenant->id)->first();

        return response()->json([
            'locked_count' => $lockedCount,
            'books_locked_until' => $settings?->books_locked_until
                ? Carbon::parse($settings->books_locked_until)->toDateString()
                : null,
        ]);
    }

    /**
     * SPEC-05 (Teil B): Status für Frontend-Banner/Dialog (JournalList.tsx) -
     * aktuelle Sperre, Anzahl offener Entwürfe, ältester offener Entwurf und ob
     * die GoBD-Frist überschritten ist (ältester offener Entwurf liegt vor dem
     * Vormonat, d.h. mindestens im Vorvormonat oder früher).
     */
    public function lockStatus(): JsonResponse
    {
        $tenant = $this->getTenantOrFail();
        $settings = CompanySetting::where('tenant_id', $tenant->id)->first();

        $openDraftsQuery = JournalEntry::where('tenant_id', $tenant->id)->where('status', 'draft');
        $openDraftsCount = (clone $openDraftsQuery)->count();
        $oldestOpenDraftDate = (clone $openDraftsQuery)->min('booking_date');

        // "älter als der Vormonat" = vor dem ersten Tag des Vormonats (also
        // Vorvormonat oder früher) - ein Entwurf INNERHALB des Vormonats gilt noch
        // als in der Kulanzfrist.
        $startOfPreviousMonth = Carbon::now()->startOfMonth()->subMonthNoOverflow();
        $gobdDeadlineExceeded = $oldestOpenDraftDate !== null
            && Carbon::parse($oldestOpenDraftDate)->lt($startOfPreviousMonth);

        return response()->json([
            'books_locked_until' => $settings?->books_locked_until
                ? Carbon::parse($settings->books_locked_until)->toDateString()
                : null,
            'open_drafts_count' => $openDraftsCount,
            'oldest_open_draft_date' => $oldestOpenDraftDate
                ? Carbon::parse($oldestOpenDraftDate)->toDateString()
                : null,
            'gobd_deadline_exceeded' => $gobdDeadlineExceeded,
        ]);
    }
}
