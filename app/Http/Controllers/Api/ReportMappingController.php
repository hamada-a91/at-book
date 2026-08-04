<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaxCode;
use App\Models\Tenant;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\ReportAccountMapping;
use App\Modules\Accounting\Reports\Bwa\BwaMappingService;
use App\Modules\Accounting\Reports\Euer\EuerMappingService;
use App\Modules\Accounting\Reports\Ustva\UstvaMappingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ReportMappingController extends Controller
{
    public function index(Request $request, BwaMappingService $mappings): JsonResponse
    {
        $tenant = $this->tenant();
        $formVersion = $request->input('form_version', BwaMappingService::FORM_VERSION);
        $rows = $mappings->mappings($tenant, $formVersion);

        return response()->json([
            'report_type' => 'bwa',
            'form_version' => $formVersion,
            'target_codes' => $mappings->lines(),
            'mappings' => $this->mappingRows($tenant, $rows),
        ]);
    }

    public function update(Request $request, BwaMappingService $mappings): JsonResponse
    {
        $formVersion = $request->input('form_version', BwaMappingService::FORM_VERSION);
        $this->replaceMappings($request, 'bwa', array_keys($mappings->lines()), $formVersion);

        return $this->index($request, $mappings);
    }

    public function ustvaIndex(Request $request, UstvaMappingService $mappings): JsonResponse
    {
        $tenant = $this->tenant();
        $formVersion = $request->input('form_version', $mappings->formVersionForYear((int) $request->input('year', UstvaMappingService::DEFAULT_YEAR)));
        $rows = $mappings->mappings($tenant, $formVersion);

        return response()->json([
            'report_type' => 'ustva',
            'form_version' => $formVersion,
            'target_codes' => $mappings->kennziffern(),
            'mappings' => $this->mappingRows($tenant, $rows),
        ]);
    }

    public function ustvaUpdate(Request $request, UstvaMappingService $mappings): JsonResponse
    {
        $formVersion = $request->input('form_version', $mappings->formVersionForYear((int) $request->input('year', UstvaMappingService::DEFAULT_YEAR)));
        $this->replaceMappings($request, 'ustva', array_keys($mappings->kennziffern()), $formVersion);

        return $this->ustvaIndex($request, $mappings);
    }

    public function euerIndex(Request $request, EuerMappingService $mappings): JsonResponse
    {
        $tenant = $this->tenant();
        $formVersion = $request->input('form_version', $mappings->formVersionForYear((int) $request->input('year', EuerMappingService::DEFAULT_YEAR)));
        $rows = $mappings->mappings($tenant, $formVersion);

        return response()->json([
            'report_type' => 'euer',
            'form_version' => $formVersion,
            'target_codes' => $mappings->lines(),
            'mappings' => $this->mappingRows($tenant, $rows),
        ]);
    }

    public function euerUpdate(Request $request, EuerMappingService $mappings): JsonResponse
    {
        $formVersion = $request->input('form_version', $mappings->formVersionForYear((int) $request->input('year', EuerMappingService::DEFAULT_YEAR)));
        $this->replaceMappings($request, 'euer', array_keys($mappings->lines()), $formVersion);

        return $this->euerIndex($request, $mappings);
    }

    /**
     * Konten, die in einer Berichts-Zuordnung sinnvoll wählbar sind.
     * Personenkonten (Debitoren/Kreditoren, an Kontakten hängend) werden immer
     * ausgeschlossen. Für die BWA nur Erfolgskonten (revenue/expense); für USt-VA
     * und EÜR zusätzlich Steuer-/Bestandskonten (asset/liability, z.B. USt/Vorsteuer).
     */
    public function mappableAccounts(Request $request): JsonResponse
    {
        $tenant = $this->tenant();
        $reportType = $request->input('report_type', 'bwa');

        $personalAccountIds = DB::table('contacts')
            ->where('tenant_id', $tenant->id)
            ->get(['customer_account_id', 'vendor_account_id'])
            ->flatMap(fn ($c) => [$c->customer_account_id, $c->vendor_account_id])
            ->filter()
            ->unique()
            ->values()
            ->all();

        $types = $reportType === 'bwa'
            ? ['revenue', 'expense']
            : ['revenue', 'expense', 'asset', 'liability'];

        $accounts = Account::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereIn('type', $types)
            ->whereNotIn('id', $personalAccountIds ?: [0])
            ->orderBy('code')
            ->get(['id', 'public_id', 'code', 'name', 'type']);

        return response()->json($accounts);
    }

    /**
     * @param  Collection<int, ReportAccountMapping>  $rows
     */
    private function mappingRows(Tenant $tenant, $rows): \Illuminate\Support\Collection
    {
        $accountByPublicId = Account::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereIn('public_id', $rows->where('source_type', 'account')->pluck('source_public_id')->all())
            ->get()
            ->keyBy('public_id');

        return $rows->map(fn (ReportAccountMapping $mapping) => [
            'public_id' => $mapping->public_id,
            'source_type' => $mapping->source_type,
            'source_public_id' => $mapping->source_public_id,
            'target_code' => $mapping->target_code,
            'value_type' => $mapping->value_type,
            'sign' => $mapping->sign,
            'valid_from' => $mapping->valid_from?->toDateString(),
            'valid_until' => $mapping->valid_until?->toDateString(),
            'source' => $mapping->source_type === 'account' ? [
                'code' => $accountByPublicId->get($mapping->source_public_id)?->code,
                'name' => $accountByPublicId->get($mapping->source_public_id)?->name,
            ] : null,
        ])->values();
    }

    /**
     * @param  array<int, string>  $targetCodes
     */
    private function replaceMappings(Request $request, string $reportType, array $targetCodes, string $formVersion): void
    {
        $tenant = $this->tenant();
        $validated = $request->validate([
            'form_version' => ['nullable', 'string', 'max:32'],
            'mappings' => ['required', 'array'],
            'mappings.*.source_type' => ['required', Rule::in(['account', 'tax_code'])],
            'mappings.*.source_public_id' => ['required', 'uuid'],
            'mappings.*.target_code' => ['required', Rule::in($targetCodes)],
            'mappings.*.value_type' => ['required', Rule::in(['base_amount', 'tax_amount', 'balance', 'debit', 'credit'])],
            'mappings.*.sign' => ['required', 'integer', Rule::in([-1, 1])],
            'mappings.*.valid_from' => ['nullable', 'date'],
            'mappings.*.valid_until' => ['nullable', 'date'],
        ]);

        foreach ($validated['mappings'] as $index => $mapping) {
            $exists = $mapping['source_type'] === 'account'
                ? Account::withoutGlobalScopes()->where('tenant_id', $tenant->id)->where('public_id', $mapping['source_public_id'])->exists()
                : TaxCode::withoutGlobalScopes()->where('tenant_id', $tenant->id)->where('public_id', $mapping['source_public_id'])->exists();

            if (! $exists) {
                throw ValidationException::withMessages([
                    "mappings.{$index}.source_public_id" => 'Die Quelle gehört nicht zum aktuellen Mandanten.',
                ]);
            }
        }

        DB::transaction(function () use ($tenant, $reportType, $formVersion, $validated) {
            ReportAccountMapping::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->where('report_type', $reportType)
                ->where('form_version', $formVersion)
                ->delete();

            foreach ($validated['mappings'] as $mapping) {
                ReportAccountMapping::withoutGlobalScopes()->create([
                    'tenant_id' => $tenant->id,
                    'report_type' => $reportType,
                    'form_version' => $formVersion,
                    'source_type' => $mapping['source_type'],
                    'source_public_id' => $mapping['source_public_id'],
                    'target_code' => $mapping['target_code'],
                    'value_type' => $mapping['value_type'],
                    'sign' => $mapping['sign'],
                    'valid_from' => $mapping['valid_from'] ?? null,
                    'valid_until' => $mapping['valid_until'] ?? null,
                ]);
            }
        });
    }

    private function tenant(): Tenant
    {
        $tenant = app('currentTenant');
        abort_unless($tenant instanceof Tenant, 403);

        return $tenant;
    }
}
