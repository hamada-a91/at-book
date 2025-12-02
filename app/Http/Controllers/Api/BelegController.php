<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Beleg;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class BelegController extends Controller
{
    public function index(Request $request)
    {
        $query = Beleg::with(['contact', 'journalEntry']);

        // Filter by document type
        if ($request->has('document_type')) {
            $query->where('document_type', $request->document_type);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by contact
        if ($request->has('contact_id')) {
            $query->where('contact_id', $request->contact_id);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('document_number', 'like', "%{$search}%")
                  ->orWhere('title', 'like', "%{$search}%");
            });
        }

        $belege = $query->latest('document_date')->get();
        return response()->json($belege);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'document_type' => 'required|in:ausgang,eingang,offen,sonstige',
            'title' => 'required|string|max:255',
            'document_date' => 'required|date',
            'amount' => 'required|integer|min:0',
            'tax_amount' => 'nullable|integer|min:0',
            'contact_id' => 'nullable|exists:contacts,id',
            'notes' => 'nullable|string',
            'due_date' => 'nullable|date',
        ]);

        // Generate document number (BEL-2025-0001)
        $year = date('Y');
        $lastBeleg = Beleg::where('document_number', 'like', "BEL-$year-%")->latest('id')->first();
        $nextNumber = $lastBeleg ? intval(substr($lastBeleg->document_number, -4)) + 1 : 1;
        $documentNumber = sprintf("BEL-%s-%04d", $year, $nextNumber);

        $beleg = Beleg::create([
            'document_number' => $documentNumber,
            'document_type' => $validated['document_type'],
            'title' => $validated['title'],
            'document_date' => $validated['document_date'],
            'amount' => $validated['amount'],
            'tax_amount' => $validated['tax_amount'] ?? 0,
            'contact_id' => $validated['contact_id'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'due_date' => $validated['due_date'] ?? null,
            'status' => 'draft',
        ]);

        // Load relationships and return
        $beleg->load(['contact', 'journalEntry']);
        
        return response()->json($beleg, 201);
    }

    public function show(Beleg $beleg)
    {
        $beleg->load(['contact', 'journalEntry']);
        return response()->json($beleg);
    }

    public function update(Request $request, Beleg $beleg)
    {
        // Only allow editing drafts
        if ($beleg->status !== 'draft') {
            return response()->json(['message' => 'Nur Entwürfe können bearbeitet werden'], 403);
        }

        $validated = $request->validate([
            'document_type' => 'required|in:ausgang,eingang,offen,sonstige',
            'title' => 'required|string|max:255',
            'document_date' => 'required|date',
            'amount' => 'required|integer|min:0',
            'tax_amount' => 'nullable|integer|min:0',
            'contact_id' => 'nullable|exists:contacts,id',
            'notes' => 'nullable|string',
            'due_date' => 'nullable|date',
        ]);

        $beleg->update($validated);

        return response()->json($beleg->load(['contact', 'journalEntry']));
    }

    public function destroy(Beleg $beleg)
    {
        if ($beleg->status !== 'draft') {
            return response()->json(['error' => 'Nur Entwürfe können gelöscht werden'], 400);
        }

        // Delete associated file if exists
        if ($beleg->file_path) {
            Storage::disk('public')->delete($beleg->file_path);
        }

        $beleg->delete();
        return response()->json(['message' => 'Beleg gelöscht']);
    }

    /**
     * Book beleg - creates journal entry with proper accounting lines
     */
    public function book(Beleg $beleg)
    {
        try {
            if ($beleg->status !== 'draft') {
                return response()->json(['error' => 'Beleg ist bereits gebucht'], 400);
            }

            // Load relationships
            $beleg->load(['contact.account']);

            // Validate contact has account
            if ($beleg->contact_id && (!$beleg->contact || !$beleg->contact->account_id)) {
                return response()->json([
                    'error' => 'Kontakt hat kein zugeordnetes Debitor/Kreditor-Konto'
                ], 400);
            }

            // Create journal entry
            $journalEntry = \App\Modules\Accounting\Models\JournalEntry::create([
                'booking_date' => $beleg->document_date,
                'description' => "{$beleg->document_number} - {$beleg->title}",
                'contact_id' => $beleg->contact_id,
                'status' => 'posted',
                'user_id' => auth()->id() ?? 1,
                'batch_id' => \Illuminate\Support\Str::uuid(),
            ]);

            // Create journal entry lines based on document type
            $netAmount = $beleg->amount - $beleg->tax_amount;
            $taxAmount = $beleg->tax_amount;

            if ($beleg->document_type === 'eingang' || $beleg->document_type === 'offen') {
                // INCOMING RECEIPT / OPEN INVOICE (Vendor/Supplier)
                // Similar to vendor invoice booking
                
                if ($beleg->contact && $beleg->contact->account_id) {
                    // 1. Haben: Kreditor (Creditor) - Gross amount
                    \App\Modules\Accounting\Models\JournalEntryLine::create([
                        'journal_entry_id' => $journalEntry->id,
                        'account_id' => $beleg->contact->account_id,
                        'type' => 'credit',
                        'amount' => $beleg->amount,
                        'tax_key' => null,
                        'tax_amount' => 0,
                    ]);

                    // 2. Soll: Aufwandskonto (Expense) - Net amount
                    // Use default expense account (6000 - Wareneinkauf or similar)
                    $expenseAccount = \App\Modules\Accounting\Models\Account::where('code', '6000')->first();
                    if ($expenseAccount) {
                        \App\Modules\Accounting\Models\JournalEntryLine::create([
                            'journal_entry_id' => $journalEntry->id,
                            'account_id' => $expenseAccount->id,
                            'type' => 'debit',
                            'amount' => $netAmount,
                            'tax_key' => null,
                            'tax_amount' => 0,
                        ]);
                    }

                    // 3. Soll: Vorsteuer (Input VAT) - Tax amount
                    if ($taxAmount > 0) {
                        // Find VAT account (1576 for 19% or 1571 for 7%)
                        $taxRate = $netAmount > 0 ? round(($taxAmount / $netAmount) * 100) : 19;
                        $vatCode = $taxRate == 7 ? '1571' : '1576';
                        $vatAccount = \App\Modules\Accounting\Models\Account::where('code', $vatCode)->first();
                        
                        if ($vatAccount) {
                            \App\Modules\Accounting\Models\JournalEntryLine::create([
                                'journal_entry_id' => $journalEntry->id,
                                'account_id' => $vatAccount->id,
                                'type' => 'debit',
                                'amount' => $taxAmount,
                                'tax_key' => null,
                                'tax_amount' => 0,
                            ]);
                        }
                    }
                }

            } elseif ($beleg->document_type === 'ausgang') {
                // OUTGOING RECEIPT (Customer)
                // Similar to customer invoice booking
                
                if ($beleg->contact && $beleg->contact->account_id) {
                    // 1. Soll: Debitor (Debtor) - Gross amount
                    \App\Modules\Accounting\Models\JournalEntryLine::create([
                        'journal_entry_id' => $journalEntry->id,
                        'account_id' => $beleg->contact->account_id,
                        'type' => 'debit',
                        'amount' => $beleg->amount,
                        'tax_key' => null,
                        'tax_amount' => 0,
                    ]);

                    // 2. Haben: Erlöskonto (Revenue) - Net amount
                    // Use default revenue account (8400 - Erlöse or similar)
                    $revenueAccount = \App\Modules\Accounting\Models\Account::where('code', '8400')->first();
                    if ($revenueAccount) {
                        \App\Modules\Accounting\Models\JournalEntryLine::create([
                            'journal_entry_id' => $journalEntry->id,
                            'account_id' => $revenueAccount->id,
                            'type' => 'credit',
                            'amount' => $netAmount,
                            'tax_key' => null,
                            'tax_amount' => 0,
                        ]);
                    }

                    // 3. Haben: Umsatzsteuer (Output VAT) - Tax amount
                    if ($taxAmount > 0) {
                        // Find VAT account (1776 for 19% or 1771 for 7%)
                        $taxRate = $netAmount > 0 ? round(($taxAmount / $netAmount) * 100) : 19;
                        $vatCode = $taxRate == 7 ? '1771' : '1776';
                        $vatAccount = \App\Modules\Accounting\Models\Account::where('code', $vatCode)->first();
                        
                        if ($vatAccount) {
                            \App\Modules\Accounting\Models\JournalEntryLine::create([
                                'journal_entry_id' => $journalEntry->id,
                                'account_id' => $vatAccount->id,
                                'type' => 'credit',
                                'amount' => $taxAmount,
                                'tax_key' => null,
                                'tax_amount' => 0,
                            ]);
                        }
                    }
                }

            } elseif ($beleg->document_type === 'sonstige') {
                // MISCELLANEOUS - Create simple entry without specific accounts
                // User should manually adjust if needed
                // For now, just mark as booked without creating lines
            }

            // Update beleg with journal entry reference
            $beleg->update([
                'status' => 'booked',
                'journal_entry_id' => $journalEntry->id,
            ]);

            return response()->json($beleg->load(['contact', 'journalEntry.lines.account']));
            
        } catch (\Exception $e) {
            \Log::error('Beleg booking failed', [
                'beleg_id' => $beleg->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return response()->json([
                'error' => 'Fehler beim Buchen des Belegs: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Upload file for beleg
     */
    public function uploadFile(Request $request, Beleg $beleg)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png|max:10240', // 10MB max
        ]);

        // Delete old file if exists
        if ($beleg->file_path) {
            Storage::disk('public')->delete($beleg->file_path);
        }

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();
        $path = $file->store('belege', 'public');

        $beleg->update([
            'file_path' => $path,
            'file_name' => $fileName,
        ]);

        return response()->json($beleg->load(['contact', 'journalEntry']));
    }

    /**
     * Download file for beleg
     */
    public function downloadFile(Beleg $beleg)
    {
        if (!$beleg->file_path || !Storage::disk('public')->exists($beleg->file_path)) {
            return response()->json(['error' => 'Datei nicht gefunden'], 404);
        }

        return Storage::disk('public')->download($beleg->file_path, $beleg->file_name);
    }
}
