<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\HasTenantScope;
use App\Http\Controllers\Controller;
use App\Models\Beleg;
use App\Models\Product;
use App\Models\TaxCode;
use App\Modules\Accounting\Models\AuditLog;
use App\Modules\Accounting\Services\BookingService;
use App\Rules\TenantExists;
use App\Services\InventoryService;
use App\Services\NumberSequenceService;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class BelegController extends Controller
{
    use HasTenantScope;

    public function __construct(
        private NumberSequenceService $numberSequenceService
    ) {}

    public function index(Request $request)
    {
        $tenant = $this->getTenantOrFail();
        $query = Beleg::where('tenant_id', $tenant->id)
            ->with(['contact', 'journalEntry', 'lines.product']);

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
            $query->where(function ($q) use ($search) {
                $q->where('document_number', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%");
            });
        }

        $belege = $query->orderByDesc('document_number')->orderByDesc('id')->get();

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
            'contact_id' => ['nullable', new TenantExists('contacts')],
            // SPEC-08 (Teil A): Default-Kostenträger-Zuordnung fürs ganze Dokument.
            'project_id' => ['nullable', new TenantExists('projects')],
            'category_account_id' => ['nullable', new TenantExists('accounts')],
            'is_paid' => 'nullable|boolean',
            'payment_account_id' => [
                'nullable',
                Rule::requiredIf(fn () => $request->boolean('is_paid')),
                new TenantExists('accounts'),
            ],
            'notes' => 'nullable|string',
            'due_date' => 'nullable|date',
            'file' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240',
            // Line items (optional)
            'lines' => 'nullable|array',
            'lines.*.product_id' => ['nullable', new TenantExists('products')],
            'lines.*.description' => 'required|string',
            'lines.*.quantity' => 'required|numeric|min:0',
            'lines.*.unit' => 'nullable|string',
            'lines.*.unit_price' => 'required|integer',
            'lines.*.tax_rate' => 'nullable|numeric|min:0',
            'lines.*.account_id' => ['nullable', new TenantExists('accounts')],
            // SPEC-08 (Teil A): Zeilen-Override der Dokument-Dimension.
            'lines.*.cost_center_id' => ['nullable', new TenantExists('cost_centers')],
            'lines.*.cost_object_id' => ['nullable', new TenantExists('cost_objects')],
        ]);

        // Handle file upload if present (Dateisystem-Operation, bewusst außerhalb
        // der DB::transaction() unten - ein Rollback der Buchhaltungsdaten löscht die
        // hochgeladene Datei nicht automatisch mit, das ist ein bestehendes Verhalten).
        $filePath = null;
        $fileName = null;
        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $fileName = $file->getClientOriginalName();
            $filePath = $file->store('belege', 'public');
        }

        // SPEC-05 (Teil A): Nummernvergabe über NumberSequenceService statt "max+1",
        // komplett innerhalb einer Transaktion.
        $beleg = DB::transaction(function () use ($validated, $filePath, $fileName) {
            $documentNumber = $this->numberSequenceService->next('beleg');

            $beleg = Beleg::create([
                'document_number' => $documentNumber,
                'document_type' => $validated['document_type'],
                'title' => $validated['title'],
                'document_date' => $validated['document_date'],
                'amount' => $validated['amount'],
                'tax_amount' => $validated['tax_amount'] ?? 0,
                'contact_id' => $validated['contact_id'] ?? null,
                'project_id' => $validated['project_id'] ?? null,
                'category_account_id' => $validated['category_account_id'] ?? null,
                'is_paid' => $validated['is_paid'] ?? false,
                'payment_account_id' => $validated['payment_account_id'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'due_date' => $validated['due_date'] ?? null,
                'file_path' => $filePath,
                'file_name' => $fileName,
                'status' => 'draft',
            ]);

            // Create beleg lines if provided
            if (! empty($validated['lines'])) {
                foreach ($validated['lines'] as $line) {
                    $lineTotal = ($line['quantity'] ?? 1) * ($line['unit_price'] ?? 0);
                    $beleg->lines()->create([
                        'product_id' => $line['product_id'] ?? null,
                        'description' => $line['description'],
                        'quantity' => $line['quantity'] ?? 1,
                        'unit' => $line['unit'] ?? 'Stück',
                        'unit_price' => $line['unit_price'] ?? 0,
                        'tax_rate' => $line['tax_rate'] ?? 19,
                        'line_total' => $lineTotal,
                        'account_id' => $line['account_id'] ?? null,
                        'cost_center_id' => $line['cost_center_id'] ?? null,
                        'cost_object_id' => $line['cost_object_id'] ?? null,
                    ]);
                }
            }

            return $beleg;
        });

        // Load relationships and return
        $beleg->load(['contact', 'journalEntry', 'categoryAccount', 'paymentAccount', 'lines.product']);

        return response()->json($beleg, 201);
    }

    public function show(Beleg $beleg)
    {
        $beleg->load(['contact', 'journalEntry', 'categoryAccount', 'paymentAccount', 'lines.product']);

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
            'contact_id' => ['nullable', new TenantExists('contacts')],
            'project_id' => ['nullable', new TenantExists('projects')],
            'category_account_id' => ['nullable', new TenantExists('accounts')],
            'is_paid' => 'nullable|boolean',
            'payment_account_id' => [
                'nullable',
                Rule::requiredIf(fn () => $request->boolean('is_paid')),
                new TenantExists('accounts'),
            ],
            'notes' => 'nullable|string',
            'due_date' => 'nullable|date',
        ]);

        $beleg->update($validated);

        return response()->json($beleg->load(['contact', 'journalEntry', 'categoryAccount', 'paymentAccount']));
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

        // Hard delete for drafts (permanently remove from database)
        $beleg->forceDelete();

        return response()->json(['message' => 'Beleg gelöscht']);
    }

    /**
     * Bucht einen Beleg (SPEC-04, 4.4/4.5): läuft komplett in EINER DB::transaction(),
     * jede erzeugte JournalEntry wird über BookingService::lockBooking() sofort
     * festgeschrieben (GoBD - vorher blieb auch die Beleg-Buchung als 'draft'
     * ungesperrt, analog zur ehemaligen Lücke in InvoiceController::book()).
     * Das USt-/Vorsteuerkonto wird nicht mehr mit festen SKR03-Kontocodes hartcodiert,
     * sondern über TaxCode::resolveOutputTaxAccount()/resolveInputTaxAccount()
     * aufgelöst - ohne konfiguriertes Konto gibt es keine stille Auslassung mehr,
     * sondern eine Exception (422).
     */
    public function book(Request $request, Beleg $beleg)
    {
        if ($beleg->status !== 'draft') {
            return response()->json(['error' => 'Beleg ist bereits verbucht oder storniert'], 400);
        }

        try {
            if ($beleg->is_paid && ! $beleg->payment_account_id) {
                throw new DomainException('Für einen als bezahlt markierten Beleg ist ein Zahlungskonto erforderlich.');
            }
            if ($beleg->is_paid) {
                $paymentAccount = \App\Modules\Accounting\Models\Account::find($beleg->payment_account_id);
                if (! $paymentAccount || $paymentAccount->type !== 'asset'
                    || preg_match('/^(10|12)\d{2}$/', (string) $paymentAccount->code) !== 1) {
                    throw new DomainException('Als Zahlungskonto ist nur ein Kassen- oder Bankkonto erlaubt.');
                }
            }

            $beleg = DB::transaction(function () use ($beleg) {
                // SPEC-05 (Teil B): Erfassungssperre gilt auch für die automatische
                // Beleg-Buchung - Belegdatum in einer festgeschriebenen Periode -> 422,
                // bevor überhaupt Konten aufgelöst/Zeilen aufgebaut werden (fail fast).
                // createBooking() prüft das ohnehin nochmal (doppelte Absicherung), aber
                // hier vermeiden wir unnötige Arbeit bei einer von vornherein unbuchbaren
                // Belegdatum-Kombination.
                app(BookingService::class)->assertPeriodOpen($beleg->document_date->format('Y-m-d'));

                $lines = [];

                // SPEC-08 (Teil A, Durchreich-Logik): Dokument.project_id -> dessen
                // cost_object_id ist der Default für ALLE Zeilen dieser Beleg-Buchung.
                // Ein Zeilen-Override ist nur möglich, wenn der Beleg GENAU EINE
                // beleg_line hat - BelegController::book() bucht Kontakt-/Kontra-/
                // USt-Zeile als EINE aggregierte Zeile pro Konto (kein Aufbau je
                // beleg_line, siehe unten), ein Override aus mehreren, ggf.
                // unterschiedlich dimensionierten beleg_lines ließe sich in dieser
                // aggregierten Struktur nicht eindeutig auf eine einzelne
                // Journalzeile zurückführen. Bei genau einer Zeile ist "die Zeile"
                // und "die aggregierte Kontra-Buchung" 1:1 dasselbe - dort greift
                // der Override.
                $beleg->loadMissing(['contact', 'project', 'lines']);

                $projectCostObjectId = $beleg->project?->cost_object_id;
                $contraCostCenterId = null;
                $contraCostObjectId = $projectCostObjectId;
                if ($beleg->lines->count() === 1) {
                    $onlyLine = $beleg->lines->first();
                    $contraCostCenterId = $onlyLine->cost_center_id;
                    $contraCostObjectId = $onlyLine->cost_object_id ?? $projectCostObjectId;
                }

                // Barbeleg / Direktzahlung ohne Kontakt: Aufwand/Erlös wird direkt
                // gegen das Zahlungskonto (Kasse/Bank) gebucht, statt über ein
                // Personenkonto (Debitor/Kreditor). Typischer Fall: bar bezahltes
                // Büromaterial ohne hinterlegten Lieferanten. Es entsteht dann KEINE
                // separate Zahlungsbuchung (die Primärbuchung settlet bereits gegen
                // die Kasse/Bank).
                $isDirectCashBeleg = ! $beleg->contact;

                if ($isDirectCashBeleg) {
                    if (! $beleg->is_paid || ! $beleg->payment_account_id) {
                        throw new DomainException('Bitte einen Kontakt auswählen – oder den Beleg als „direkt bezahlt" mit Zahlungskonto (Kasse/Bank) erfassen.');
                    }
                    $contactAccountId = $beleg->payment_account_id;
                } elseif ($beleg->document_type === 'ausgang') {
                    // Determine account based on document type
                    $contactAccountId = $beleg->contact->customer_account_id ?? $beleg->contact->vendor_account_id;
                } else {
                    // eingang, offen, sonstige -> treat as incoming/vendor usually
                    $contactAccountId = $beleg->contact->vendor_account_id ?? $beleg->contact->customer_account_id;
                }

                if (! $contactAccountId) {
                    throw new DomainException('Kein passendes Konto für den Kontakt gefunden.');
                }

                $contactLineType = ($beleg->document_type === 'ausgang') ? 'debit' : 'credit';
                $lines[] = [
                    'account_id' => $contactAccountId,
                    'type' => $contactLineType,
                    'amount' => $beleg->amount,
                    'cost_object_id' => $projectCostObjectId,
                ];

                // 2. Contra Account (Revenue/Expense) - Use user-selected Sachkonto or fallback
                $contraAccount = null;

                if ($beleg->category_account_id) {
                    $contraAccount = \App\Modules\Accounting\Models\Account::find($beleg->category_account_id);
                }

                if (! $contraAccount) {
                    $contraAccountType = ($beleg->document_type === 'ausgang') ? 'revenue' : 'expense';
                    $contraAccount = \App\Modules\Accounting\Models\Account::where('type', $contraAccountType)
                        ->orderBy('code')
                        ->first();
                }

                if (! $contraAccount) {
                    throw new DomainException('Kein Sachkonto (Kategorie) ausgewählt.');
                }

                $contraLineType = ($beleg->document_type === 'ausgang') ? 'credit' : 'debit';
                $netAmount = $beleg->amount - $beleg->tax_amount;

                // SPEC-08 (Teil A, Kosten-Nachweis-Ableitung): tax_amount wird HIER
                // informativ auf der Kontra-Zeile (Aufwand/Erlös) annotiert - analog zu
                // InvoiceBookingService::buildLines() (siehe dortiger Kommentar).
                // amount bleibt netto, beeinflusst NICHT die Soll=Haben-Prüfung.
                $lines[] = [
                    'account_id' => $contraAccount->id,
                    'type' => $contraLineType,
                    'amount' => $netAmount,
                    'tax_amount' => $beleg->tax_amount,
                    'cost_center_id' => $contraCostCenterId,
                    'cost_object_id' => $contraCostObjectId,
                ];

                // 3. Tax Line - Steuersatz aus Betrag/Nettobetrag ableiten (Beleg hat keinen
                // eigenen tax_rate-Kopf, nur amount/tax_amount).
                if ($beleg->tax_amount > 0) {
                    $rate = $netAmount > 0
                        ? round(($beleg->tax_amount / $netAmount) * 100)
                        : 19.0;

                    $taxAccount = ($beleg->document_type === 'ausgang')
                        ? TaxCode::resolveOutputTaxAccount((float) $rate)
                        : TaxCode::resolveInputTaxAccount((float) $rate);

                    $lines[] = [
                        'account_id' => $taxAccount->id,
                        'type' => $contraLineType,
                        'amount' => $beleg->tax_amount,
                        'cost_object_id' => $projectCostObjectId,
                    ];
                }

                $bookingService = app(BookingService::class);
                $journalEntry = $bookingService->createBooking([
                    'date' => $beleg->document_date->format('Y-m-d'),
                    'description' => $beleg->title,
                    'contact_id' => $beleg->contact_id,
                    'lines' => $lines,
                ]);
                $bookingService->lockBooking($journalEntry->id);

                // If marked as paid, create a payment booking (Personenkonto -> Kasse/Bank).
                // Beim Barbeleg ohne Kontakt entfällt das: die Primärbuchung oben hat
                // Aufwand/Erlös bereits direkt gegen das Zahlungskonto gebucht.
                $paymentJournalEntry = null;
                if (! $isDirectCashBeleg && $beleg->is_paid && $beleg->payment_account_id) {
                    $paymentAccount = \App\Modules\Accounting\Models\Account::find($beleg->payment_account_id);

                    if ($paymentAccount) {
                        if ($beleg->document_type === 'ausgang') {
                            // Outgoing (sales): Bank/Cash debit, Customer credit
                            $paymentLines = [
                                ['account_id' => $beleg->payment_account_id, 'type' => 'debit', 'amount' => $beleg->amount],
                                ['account_id' => $contactAccountId, 'type' => 'credit', 'amount' => $beleg->amount],
                            ];
                        } else {
                            // Incoming (purchase): Vendor debit, Bank/Cash credit
                            $paymentLines = [
                                ['account_id' => $contactAccountId, 'type' => 'debit', 'amount' => $beleg->amount],
                                ['account_id' => $beleg->payment_account_id, 'type' => 'credit', 'amount' => $beleg->amount],
                            ];
                        }

                        $paymentJournalEntry = $bookingService->createBooking([
                            'date' => $beleg->document_date->format('Y-m-d'),
                            'description' => 'Zahlung: '.$beleg->title,
                            'contact_id' => $beleg->contact_id,
                            'lines' => $paymentLines,
                        ]);
                        $bookingService->lockBooking($paymentJournalEntry->id);
                    }
                }

                // Bestehender Sofort-zahlen-Flow wird in das neue OPOS-Ledger
                // übernommen. Barbelege ohne Kontakt sind bereits durch die
                // Primärbuchung ausgeglichen und bleiben bewusst ohne OPOS-Zeile.
                if ($paymentJournalEntry) {
                    \App\Models\Payment::create([
                        'payable_type' => 'beleg',
                        'payable_id' => $beleg->id,
                        'amount' => (int) $beleg->amount,
                        'payment_date' => $beleg->document_date->format('Y-m-d'),
                        'payment_account_id' => $beleg->payment_account_id,
                        'journal_entry_id' => $paymentJournalEntry->id,
                        'discount_amount' => 0,
                    ]);
                }

                $oldBelegStatus = $beleg->status;

                $beleg->update([
                    'status' => ($beleg->is_paid && $beleg->payment_account_id) ? 'paid' : 'booked',
                    'journal_entry_id' => $journalEntry->id,
                    'amount_paid' => ($beleg->is_paid && $beleg->payment_account_id) ? (int) $beleg->amount : 0,
                ]);

                // SPEC-06: fachlicher Event, explizit hier gefeuert (siehe
                // AuditObserver::isServiceManaged() - unterdrückt den
                // generischen 'updated'-Eintrag für genau diesen Übergang).
                AuditLog::record(
                    $beleg,
                    'booked',
                    ['status' => $oldBelegStatus, 'journal_entry_id' => null],
                    ['status' => $beleg->status, 'journal_entry_id' => $beleg->journal_entry_id]
                );

                // Process inventory for product lines (innerhalb derselben Transaktion)
                $beleg->load('lines.product');
                $inventoryService = new InventoryService;

                foreach ($beleg->lines as $line) {
                    if (empty($line->product_id) || $line->quantity <= 0) {
                        continue;
                    }

                    $product = Product::find($line->product_id);
                    if (! $product) {
                        continue;
                    }

                    if ($beleg->document_type === 'eingang') {
                        $inventoryService->addStock(
                            $product,
                            $line->quantity,
                            'purchase',
                            "Einkauf via Beleg {$beleg->document_number}",
                            $beleg
                        );
                    } elseif ($beleg->document_type === 'ausgang') {
                        $inventoryService->removeStock(
                            $product,
                            $line->quantity,
                            'sale',
                            "Verkauf via Beleg {$beleg->document_number}",
                            $beleg
                        );
                    }
                }

                return $beleg;
            });
        } catch (DomainException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            \Log::error('Beleg booking failed', [
                'beleg_id' => $beleg->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Fehler beim Buchen des Belegs.'], 422);
        }

        return response()->json($beleg->load(['contact', 'journalEntry', 'lines.product']));
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

        $oldFilePath = $beleg->file_path;
        $oldFileName = $beleg->file_name;

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();
        $path = $file->store('belege', 'public');

        $beleg->update([
            'file_path' => $path,
            'file_name' => $fileName,
        ]);

        // SPEC-06: fachlicher Event, explizit hier gefeuert (siehe
        // AuditObserver::isServiceManaged() - unterdrückt den generischen
        // 'updated'-Eintrag für genau diesen Übergang).
        AuditLog::record(
            $beleg,
            'file_uploaded',
            ['file_path' => $oldFilePath, 'file_name' => $oldFileName],
            ['file_path' => $beleg->file_path, 'file_name' => $beleg->file_name]
        );

        return response()->json($beleg->load(['contact', 'journalEntry']));
    }

    /**
     * Download file for beleg
     */
    public function downloadFile(Beleg $beleg)
    {
        if (! $beleg->file_path || ! Storage::disk('public')->exists($beleg->file_path)) {
            return response()->json(['error' => 'Datei nicht gefunden'], 404);
        }

        return Storage::disk('public')->download($beleg->file_path, $beleg->file_name);
    }
}
