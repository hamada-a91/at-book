<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\HasTenantScope;
use App\Http\Controllers\Controller;
use App\Models\BankTransaction;
use App\Modules\Accounting\Models\AuditLog;
use App\Modules\Projects\Models\Project;
use App\Rules\TenantExists;
use App\Services\Banking\BankCsvImportService;
use App\Services\Banking\BankMatchingService;
use App\Services\Banking\BankReconciliationService;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class BankTransactionController extends Controller
{
    use HasTenantScope;

    public function __construct(
        private BankReconciliationService $reconciliationService,
        private BankMatchingService $matchingService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenant = $this->getTenantOrFail();
        $query = BankTransaction::where('tenant_id', $tenant->id)
            ->with(['bankAccount', 'journalEntry'])
            ->latest('booking_date')
            ->latest('id');

        if ($request->filled('bank_account_id')) {
            $query->where('bank_account_id', $request->integer('bank_account_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('from')) {
            $query->whereDate('booking_date', '>=', $request->date('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('booking_date', '<=', $request->date('to'));
        }
        if ($request->filled('q')) {
            $q = (string) $request->string('q');
            $query->where(function ($inner) use ($q) {
                $inner->where('counterparty', 'like', "%{$q}%")
                    ->orWhere('purpose', 'like', "%{$q}%");
            });
        }

        return response()->json($query->paginate($request->integer('per_page', 25)));
    }

    public function suggestions(): JsonResponse
    {
        $tenant = $this->getTenantOrFail();
        $transactions = BankTransaction::where('tenant_id', $tenant->id)
            ->where('status', BankTransaction::STATUS_UNMATCHED)
            ->with('bankAccount')
            ->latest('booking_date')
            ->get()
            ->map(fn (BankTransaction $transaction) => [
                'transaction' => $transaction,
                'suggestions' => $this->matchingService->suggest($transaction),
            ])
            ->filter(fn (array $item) => ! empty($item['suggestions']))
            ->values();

        return response()->json($transactions);
    }

    public function assignSuggestions(): JsonResponse
    {
        $tenant = $this->getTenantOrFail();
        $assigned = 0;
        $errors = [];

        $transactions = BankTransaction::where('tenant_id', $tenant->id)
            ->where('status', BankTransaction::STATUS_UNMATCHED)
            ->orderBy('booking_date')
            ->get();

        foreach ($transactions as $transaction) {
            $suggestion = collect($this->matchingService->suggest($transaction))
                ->first(fn (array $item) => ($item['score'] ?? 0) >= 90);

            if (! $suggestion) {
                continue;
            }

            try {
                $this->reconciliationService->assign($transaction, $suggestion['target_type'] === 'category'
                    ? ['target_type' => 'category', 'account_id' => $suggestion['target_id']]
                    : ['target_type' => $suggestion['target_type'], 'target_id' => $suggestion['target_id']]
                );
                $assigned++;
            } catch (Throwable $exception) {
                $errors[] = [
                    'transaction_id' => $transaction->id,
                    'error' => $exception->getMessage(),
                ];
            }
        }

        return response()->json([
            'assigned' => $assigned,
            'errors' => $errors,
        ]);
    }

    public function show(BankTransaction $tx): JsonResponse
    {
        $this->assertTenantModel($tx);

        return response()->json($tx->fresh(['bankAccount', 'journalEntry']));
    }

    public function update(Request $request, BankTransaction $tx, BankCsvImportService $csvImportService): JsonResponse
    {
        $this->assertTenantModel($tx);

        if ($tx->status === BankTransaction::STATUS_MATCHED) {
            return response()->json(['error' => 'Zugeordnete Bankumsätze können nicht direkt bearbeitet werden.'], 422);
        }

        $validated = $request->validate([
            'booking_date' => ['required', 'date', 'after_or_equal:2014-01-01'],
            'value_date' => ['nullable', 'date'],
            'counterparty' => ['nullable', 'string', 'max:255'],
            'purpose' => ['nullable', 'string', 'max:5000'],
            'amount' => ['required', 'integer', 'not_in:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $validated['currency'] = strtoupper($validated['currency'] ?? $tx->currency ?? 'EUR');
        $validated['counterparty'] = $validated['counterparty'] ?? null;
        $validated['purpose'] = $validated['purpose'] ?? null;
        $validated['value_date'] = $validated['value_date'] ?? null;
        $validated['notes'] = $validated['notes'] ?? null;
        $validated['fingerprint'] = $csvImportService->fingerprint(
            (int) $tx->bank_account_id,
            $validated['booking_date'],
            (int) $validated['amount'],
            $validated['purpose'],
            $validated['counterparty'],
        );

        $duplicate = BankTransaction::where('tenant_id', $tx->tenant_id)
            ->where('fingerprint', $validated['fingerprint'])
            ->whereKeyNot($tx->id)
            ->exists();
        if ($duplicate) {
            return response()->json(['error' => 'Diese Änderung würde einen bereits importierten Umsatz duplizieren.'], 422);
        }

        $old = $tx->only(['booking_date', 'value_date', 'counterparty', 'purpose', 'amount', 'currency', 'notes', 'fingerprint']);
        $tx->update($validated);
        AuditLog::record($tx, 'bank_tx_updated', $old, $tx->fresh()->only(array_keys($old)));

        return response()->json($tx->fresh(['bankAccount', 'journalEntry']));
    }

    public function assign(Request $request, BankTransaction $tx): JsonResponse
    {
        $this->assertTenantModel($tx);
        $validated = $request->validate([
            'target_type' => ['required', 'in:invoice,beleg,category'],
            'target_id' => ['required_if:target_type,invoice,beleg', 'integer'],
            'account_id' => ['required_if:target_type,category', new TenantExists('accounts')],
            'tax_amount' => ['nullable', 'integer', 'min:0'],
            'tax_account_id' => ['nullable', new TenantExists('accounts')],
            'discount_amount' => ['nullable', 'integer', 'min:0'],
            'discount_account_id' => ['nullable', new TenantExists('accounts')],
            'project_id' => ['nullable', new TenantExists('projects')],
            'cost_center_id' => ['nullable', new TenantExists('cost_centers')],
            'cost_object_id' => ['nullable', new TenantExists('cost_objects')],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        if (($validated['target_type'] ?? null) === 'category' && ! empty($validated['project_id']) && empty($validated['cost_object_id'])) {
            $validated['cost_object_id'] = Project::where('tenant_id', $tx->tenant_id)
                ->whereKey($validated['project_id'])
                ->value('cost_object_id');
        }

        try {
            $transaction = $this->reconciliationService->assign($tx, $validated);
        } catch (DomainException $exception) {
            return response()->json(['error' => $exception->getMessage()], 422);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['error' => 'Fehler beim Zuordnen des Bankumsatzes.'], 422);
        }

        return response()->json($transaction);
    }

    public function ignore(Request $request, BankTransaction $tx): JsonResponse
    {
        $this->assertTenantModel($tx);
        $validated = $request->validate(['note' => ['nullable', 'string', 'max:2000']]);

        try {
            $transaction = $this->reconciliationService->ignore($tx, $validated['note'] ?? null);
        } catch (DomainException $exception) {
            return response()->json(['error' => $exception->getMessage()], 422);
        }

        return response()->json($transaction);
    }

    public function unassign(BankTransaction $tx): JsonResponse
    {
        $this->assertTenantModel($tx);

        try {
            $transaction = $this->reconciliationService->unassign($tx);
        } catch (DomainException $exception) {
            return response()->json(['error' => $exception->getMessage()], 422);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['error' => 'Fehler beim Aufheben der Zuordnung.'], 422);
        }

        return response()->json($transaction);
    }

    private function assertTenantModel(BankTransaction $transaction): void
    {
        $tenant = $this->getTenantOrFail();
        abort_if($transaction->tenant_id !== $tenant->id, 404);
    }
}
