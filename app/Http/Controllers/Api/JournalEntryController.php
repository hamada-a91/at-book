<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\HasTenantScope;
use App\Modules\Accounting\Services\BookingService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

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
            'contact_id' => 'nullable|exists:contacts,id',
            'beleg_id' => 'nullable|exists:belege,id',
            'lines' => 'required|array|min:2',
            'lines.*.account_id' => 'required|exists:accounts,id',
            'lines.*.type' => 'required|in:debit,credit',
            'lines.*.amount' => 'required|integer|min:1',
            'lines.*.tax_key' => 'nullable|string',
            'lines.*.tax_amount' => 'nullable|integer',
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
            $query->where(function($q) use ($search) {
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
}
