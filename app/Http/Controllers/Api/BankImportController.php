<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\HasTenantScope;
use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\BankImportBatch;
use App\Services\Banking\BankCsvImportService;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class BankImportController extends Controller
{
    use HasTenantScope;

    public function __construct(private BankCsvImportService $importService) {}

    public function preview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
            'bank_account_id' => ['required', 'integer'],
            'settings' => ['nullable'],
        ]);

        $bankAccount = $this->bankAccount((int) $validated['bank_account_id']);

        try {
            $preview = $this->importService->preview(
                $request->file('file'),
                $bankAccount,
                $this->settings($request->input('settings', []))
            );
        } catch (DomainException $exception) {
            return response()->json(['error' => $exception->getMessage()], 422);
        }

        return response()->json($preview);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
            'bank_account_id' => ['required', 'integer'],
            'settings' => ['required'],
        ]);

        $bankAccount = $this->bankAccount((int) $validated['bank_account_id']);

        try {
            $result = $this->importService->import(
                $request->file('file'),
                $bankAccount,
                $this->settings($request->input('settings'))
            );
        } catch (DomainException $exception) {
            return response()->json(['error' => $exception->getMessage()], 422);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['error' => 'Fehler beim Importieren der Bankumsätze.'], 422);
        }

        return response()->json($result, 201);
    }

    public function skipped(BankImportBatch $batch): StreamedResponse
    {
        $this->assertTenantModel($batch);
        $filename = 'nicht-importierte-bankumsaetze-'.$batch->public_id.'.csv';

        return response()->streamDownload(function () use ($batch) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['row_number', 'reason', 'raw_json']);

            foreach ($batch->skipped_rows ?? [] as $row) {
                fputcsv($handle, [
                    $row['row_number'] ?? null,
                    $row['reason'] ?? null,
                    json_encode($row['raw'] ?? [], JSON_UNESCAPED_UNICODE),
                ]);
            }

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function bankAccount(int $id): BankAccount
    {
        $tenant = $this->getTenantOrFail();

        return BankAccount::where('tenant_id', $tenant->id)->findOrFail($id);
    }

    private function assertTenantModel(BankImportBatch $batch): void
    {
        $tenant = $this->getTenantOrFail();
        abort_if($batch->tenant_id !== $tenant->id, 404);
    }

    private function settings(mixed $settings): array
    {
        if (is_array($settings)) {
            return $settings;
        }

        if (is_string($settings)) {
            $decoded = json_decode($settings, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return [];
    }
}
