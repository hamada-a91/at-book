<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaxCode;
use App\Models\Tenant;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\ReportAccountMapping;
use App\Modules\Accounting\Reports\Bwa\BwaMappingService;
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
        $accountByPublicId = Account::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereIn('public_id', $rows->where('source_type', 'account')->pluck('source_public_id')->all())
            ->get()
            ->keyBy('public_id');

        return response()->json([
            'report_type' => 'bwa',
            'form_version' => $formVersion,
            'target_codes' => $mappings->lines(),
            'mappings' => $rows->map(fn (ReportAccountMapping $mapping) => [
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
            ])->values(),
        ]);
    }

    public function update(Request $request, BwaMappingService $mappings): JsonResponse
    {
        $tenant = $this->tenant();
        $formVersion = $request->input('form_version', BwaMappingService::FORM_VERSION);
        $targetCodes = array_keys($mappings->lines());

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

        DB::transaction(function () use ($tenant, $formVersion, $validated) {
            ReportAccountMapping::withoutGlobalScopes()
                ->where('tenant_id', $tenant->id)
                ->where('report_type', 'bwa')
                ->where('form_version', $formVersion)
                ->delete();

            foreach ($validated['mappings'] as $mapping) {
                ReportAccountMapping::withoutGlobalScopes()->create([
                    'tenant_id' => $tenant->id,
                    'report_type' => 'bwa',
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

        return $this->index($request, $mappings);
    }

    private function tenant(): Tenant
    {
        $tenant = app('currentTenant');
        abort_unless($tenant instanceof Tenant, 403);

        return $tenant;
    }
}
