<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Beleg;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

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
            'file' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240', // 10MB max
        ]);

        // Generate document number (BEL-2025-0001)
        $year = date('Y');
        $lastBeleg = Beleg::withTrashed()->where('document_number', 'like', "BEL-$year-%")->latest('id')->first();
        $nextNumber = $lastBeleg ? intval(substr($lastBeleg->document_number, -4)) + 1 : 1;
        $documentNumber = sprintf("BEL-%s-%04d", $year, $nextNumber);

        // Handle file upload if present
        $filePath = null;
        $fileName = null;
        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $fileName = $file->getClientOriginalName();
            $filePath = $file->store('belege', 'public');
        }

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
            'file_path' => $filePath,
            'file_name' => $fileName,
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

    public function book(Request $request, Beleg $beleg)
    {
        if ($beleg->status !== 'draft') {
            return response()->json(['error' => 'Beleg ist bereits verbucht oder storniert'], 400);
        }

        // Logic to create a Journal Entry from the Beleg
        // This is a simplified version. In a real app, you'd likely have a more complex service.
        
        try {
            DB::beginTransaction();

            $lines = [];
            
            // 1. Contact Line (Debitor/Kreditor)
            if ($beleg->contact_id && (!$beleg->contact || !$beleg->contact->account_id)) {
                 // Reload contact to be sure
                 $beleg->load('contact');
            }

            if ($beleg->contact) {
                // Determine account based on document type
                $accountId = null;
                if ($beleg->document_type === 'ausgang') {
                    $accountId = $beleg->contact->customer_account_id ?? $beleg->contact->vendor_account_id;
                } else {
                    // eingang, offen, sonstige -> treat as incoming/vendor usually
                    $accountId = $beleg->contact->vendor_account_id ?? $beleg->contact->customer_account_id;
                }

                if ($accountId) {
                    $type = ($beleg->document_type === 'ausgang') ? 'debit' : 'credit';
                    
                    $lines[] = [
                        'account_id' => $accountId,
                        'type' => $type,
                        'amount' => $beleg->amount,
                        'tax_key' => null,
                        'tax_amount' => 0,
                    ];
                } else {
                    throw new \Exception('Kein passendes Konto für den Kontakt gefunden.');
                }
            } else {
                 // If no contact/account, we can't auto-book fully. 
                 throw new \Exception('Kein Kontakt ausgewählt.');
            }

            // 2. Contra Account (Revenue/Expense) - Placeholder
            $contraAccountCode = ($beleg->document_type === 'ausgang') ? '8400' : '3400'; // SKR03/04 examples
            $contraAccount = \App\Modules\Accounting\Models\Account::where('code', $contraAccountCode)->first();
            
            if (!$contraAccount) {
                 // Fallback to any revenue/expense
                 $type = ($beleg->document_type === 'ausgang') ? 'revenue' : 'expense';
                 $contraAccount = \App\Modules\Accounting\Models\Account::where('type', $type)->first();
            }

            if ($contraAccount) {
                $type = ($beleg->document_type === 'ausgang') ? 'credit' : 'debit';
                $netAmount = $beleg->amount - $beleg->tax_amount;
                
                $lines[] = [
                    'account_id' => $contraAccount->id,
                    'type' => $type,
                    'amount' => $netAmount,
                    'tax_key' => null, // Simplified
                    'tax_amount' => 0,
                ];
                
                // 3. Tax Line
                if ($beleg->tax_amount > 0) {
                     // Find tax account... simplified
                     // Assuming 19%
                     $taxAccountCode = ($beleg->document_type === 'ausgang') ? '1776' : '1576';
                     $taxAccount = \App\Modules\Accounting\Models\Account::where('code', $taxAccountCode)->first();
                     
                     if ($taxAccount) {
                        $lines[] = [
                            'account_id' => $taxAccount->id,
                            'type' => $type, // Same side as revenue/expense usually? No.
                            // Sales: Revenue Credit, VAT Credit.
                            // Purchase: Expense Debit, Input Tax Debit.
                            'amount' => $beleg->tax_amount,
                            'tax_key' => null,
                            'tax_amount' => 0,
                        ];
                     }
                }
            } else {
                 throw new \Exception('Kein Gegenkonto gefunden.');
            }

            $bookingService = app(\App\Modules\Accounting\Services\BookingService::class);
            $journalEntry = $bookingService->createBooking([
                'date' => $beleg->document_date->format('Y-m-d'),
                'description' => $beleg->title,
                'contact_id' => $beleg->contact_id,
                'lines' => $lines
            ]);

            $beleg->update([
                'status' => 'booked',
                'journal_entry_id' => $journalEntry->id,
            ]);

            DB::commit();

            return response()->json($beleg);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
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
