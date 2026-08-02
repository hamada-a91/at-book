<?php

namespace App\Modules\Accounting\Reports;

use App\Models\Tenant;
use App\Modules\Accounting\Reports\Concerns\BuildsReportPayload;
use App\Modules\Accounting\Reports\Euer\EuerMappingService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class EuerReport
{
    use BuildsReportPayload;

    private const SUPPORTED_TAX_KEYS = ['UST19', 'UST7', 'VST19', 'VST7'];

    public function __construct(
        private readonly EuerMappingService $mappings,
        private readonly ReportQueryService $queries,
        private readonly ReportQualityService $quality,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function generate(ReportPeriod $period): array
    {
        $tenant = $this->tenant();
        $formVersion = $this->mappings->formVersionForYear((int) $period->to->year);
        $mappingRows = $this->mappings->mappings($tenant, $formVersion);

        // Fetch accounts keyed by ID and public_id
        $accounts = DB::table('accounts')->where('tenant_id', $tenant->id)->get();
        $accountsById = $accounts->keyBy('id');

        $allocations = [];

        // 1. Process ledger payments
        $payments = \App\Models\Payment::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereNull('reversed_at')
            ->whereBetween('payment_date', [$period->from->toDateString(), $period->to->toDateString()])
            ->get();

        foreach ($payments as $payment) {
            $payable = $payment->payable_type === 'invoice'
                ? \App\Models\Invoice::withoutGlobalScopes()->find($payment->payable_id)
                : \App\Models\Beleg::withoutGlobalScopes()->find($payment->payable_id);

            if (! $payable || ! $payable->journal_entry_id) {
                continue;
            }

            $lines = DB::table('journal_entry_lines')
                ->where('journal_entry_id', $payable->journal_entry_id)
                ->get();

            $isOutgoing = ($payment->payable_type === 'invoice') || ($payable instanceof \App\Models\Beleg && $payable->document_type === 'ausgang');

            if ($isOutgoing) {
                $contactLines = $lines->where('type', 'debit');
                $valueLines = $lines->where('type', 'credit')->values();
            } else {
                $contactLines = $lines->where('type', 'credit');
                $valueLines = $lines->where('type', 'debit')->values();
            }

            $T = (int) $contactLines->sum('amount');
            if ($T <= 0 || $valueLines->isEmpty()) {
                continue;
            }

            $allocatedSum = 0;
            $paymentAmount = (int) $payment->amount;

            foreach ($valueLines as $index => $line) {
                if ($index === count($valueLines) - 1) {
                    $share = $paymentAmount - $allocatedSum;
                } else {
                    $share = (int) round(($line->amount * $paymentAmount) / $T);
                    $allocatedSum += $share;
                }

                $account = $accountsById->get($line->account_id);
                if (! $account) {
                    continue;
                }

                $docNum = $payable instanceof \App\Models\Invoice ? $payable->invoice_number : $payable->document_number;
                $docTitle = $payable instanceof \App\Models\Invoice
                    ? "Zahlung Rechnung {$payable->invoice_number} - {$payable->contact->name}"
                    : "Zahlung Beleg {$payable->document_number} - {$payable->contact->name}";

                $allocations[] = [
                    'date' => $payment->payment_date->toDateString(),
                    'account_id' => $line->account_id,
                    'account_code' => $account->code,
                    'account_name' => $account->name,
                    'account_public_id' => $account->public_id,
                    'account_type' => $account->type,
                    'amount' => $share,
                    'document_type' => $payment->payable_type,
                    'document_number' => $docNum,
                    'document_title' => $docTitle,
                ];
            }
        }

        // 2. Process direct cash/bank Belege
        $directCashBelege = \App\Models\Beleg::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereNull('contact_id')
            ->where('is_paid', true)
            ->whereNotNull('payment_account_id')
            ->whereIn('status', ['paid', 'booked'])
            ->whereBetween('document_date', [$period->from->toDateString(), $period->to->toDateString()])
            ->get();

        foreach ($directCashBelege as $beleg) {
            if (! $beleg->journal_entry_id) {
                continue;
            }

            $lines = DB::table('journal_entry_lines')
                ->where('journal_entry_id', $beleg->journal_entry_id)
                ->get();

            $isOutgoing = ($beleg->document_type === 'ausgang');

            if ($isOutgoing) {
                $valueLines = $lines->where('type', 'credit')->values();
            } else {
                $valueLines = $lines->where('type', 'debit')->values();
            }

            foreach ($valueLines as $line) {
                $account = $accountsById->get($line->account_id);
                if (! $account) {
                    continue;
                }

                $allocations[] = [
                    'date' => $beleg->document_date->toDateString(),
                    'account_id' => $line->account_id,
                    'account_code' => $account->code,
                    'account_name' => $account->name,
                    'account_public_id' => $account->public_id,
                    'account_type' => $account->type,
                    'amount' => (int) $line->amount,
                    'document_type' => 'beleg',
                    'document_number' => $beleg->document_number,
                    'document_title' => $beleg->title ?: "Direktbeleg {$beleg->document_number}",
                ];
            }
        }

        // Initialize EÜR rows
        $rows = [];
        foreach ($this->mappings->lines() as $code => $definition) {
            $rows[$code] = [
                'zeile' => $code,
                'label' => $definition['label'],
                'type' => $definition['type'],
                'order' => $definition['order'],
                'amount' => 0,
                'herleitung' => [],
            ];
        }

        // Allocate cash flows to EÜR rows
        foreach ($allocations as $alloc) {
            $mapping = $mappingRows->where('source_type', 'account')->where('source_public_id', $alloc['account_public_id'])->first();
            if ($mapping) {
                $targetCode = $mapping->target_code;
                if (isset($rows[$targetCode])) {
                    $amount = $alloc['amount'] * (int) $mapping->sign;
                    $rows[$targetCode]['amount'] += $amount;
                    $rows[$targetCode]['herleitung'][] = [
                        'date' => $alloc['date'],
                        'document_type' => $alloc['document_type'],
                        'document_number' => $alloc['document_number'],
                        'document_title' => $alloc['document_title'],
                        'account_code' => $alloc['account_code'],
                        'account_name' => $alloc['account_name'],
                        'amount' => $amount,
                    ];
                }
            }
        }

        // Calculate Ergebnis row
        $einnahmenKeys = ['betriebseinnahmen', 'ust_einnahmen', 'ust_erstattung'];
        $ausgabenKeys = ['wareneinkauf', 'personal', 'raumkosten', 'ust_ausgaben', 'ust_zahlung', 'sonstige_ausgaben'];

        $einnahmenSum = 0;
        foreach ($einnahmenKeys as $key) {
            $einnahmenSum += $rows[$key]['amount'] ?? 0;
        }

        $ausgabenSum = 0;
        foreach ($ausgabenKeys as $key) {
            $ausgabenSum += $rows[$key]['amount'] ?? 0;
        }

        $rows['ergebnis']['amount'] = $einnahmenSum - $ausgabenSum;
        $rows['ergebnis']['herleitung'] = [
            ['account_code' => 'Einnahmen', 'account_name' => 'Betriebseinnahmen gesamt', 'amount' => $einnahmenSum, 'document_type' => 'system', 'date' => $period->to->toDateString(), 'document_number' => '', 'document_title' => 'Summe Einnahmen'],
            ['account_code' => 'Ausgaben', 'account_name' => 'Betriebsausgaben gesamt', 'amount' => -$ausgabenSum, 'document_type' => 'system', 'date' => $period->to->toDateString(), 'document_number' => '', 'document_title' => 'Summe Ausgaben'],
        ];

        uasort($rows, fn (array $a, array $b) => $a['order'] <=> $b['order']);

        $totals = [
            'total_revenue' => $einnahmenSum,
            'total_expense' => $ausgabenSum,
            'net_profit' => $einnahmenSum - $ausgabenSum,
            'mapped_accounts' => $mappingRows->where('source_type', 'account')->pluck('source_public_id')->unique()->count(),
        ];

        // Safe assess quality metrics
        $quality = $this->quality->safeAssess('euer', $period, $totals);
        foreach ($this->specialCaseBlockers($period, $mappingRows, $allocations) as $blocker) {
            $quality['blocking_errors'][] = $blocker;
        }
        $quality['status'] = $quality['blocking_errors'] === [] ? (($quality['warnings'] ?? []) === [] ? 'ok' : 'warning') : 'error';

        $data = [
            'form_version' => $formVersion,
            'rows' => array_values($rows),
        ];

        return $this->payload('euer', $period, $data, $totals, $quality, [
            'rows' => $data['rows'],
            'form_version' => $formVersion,
        ]);
    }

    /**
     * @param  Collection<int, mixed>  $mappingRows
     * @param  array<int, array<string, mixed>>  $allocations
     * @return array<int, array<string, mixed>>
     */
    private function specialCaseBlockers(ReportPeriod $period, Collection $mappingRows, array $allocations): array
    {
        $blockers = [];

        // 1. Unmapped revenue/expense accounts with payments in period
        $mappedPublicIds = $mappingRows->where('source_type', 'account')->pluck('source_public_id')->unique()->all();
        $unmappedActiveAccounts = [];
        $allocationsByAccount = collect($allocations)->groupBy('account_public_id');

        foreach ($allocationsByAccount as $publicId => $accAllocs) {
            $totalAllocAmt = $accAllocs->sum('amount');
            if ($totalAllocAmt === 0) {
                continue;
            }

            $firstAlloc = $accAllocs->first();
            $accType = $firstAlloc['account_type'];

            if (in_array($accType, ['revenue', 'expense'], true) && ! in_array($publicId, $mappedPublicIds, true)) {
                $unmappedActiveAccounts[] = [
                    'account_code' => $firstAlloc['account_code'],
                    'account_name' => $firstAlloc['account_name'],
                    'amount' => $totalAllocAmt,
                ];
            }
        }

        if (count($unmappedActiveAccounts) > 0) {
            $blockers[] = [
                'code' => 'euer_unmapped_active_accounts',
                'severity' => 'error',
                'message' => 'Ertrags- oder Aufwandskonto mit Zahlungsbewegung ist keiner EÜR-Zeile zugeordnet.',
                'affected_count' => count($unmappedActiveAccounts),
                'drilldown' => $unmappedActiveAccounts,
            ];
        }

        // 2. Unsupported tax keys
        $tenantId = $this->queries->tenantId();
        $unsupportedTaxKeys = DB::table('journal_entry_lines')
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
            ->whereNull('journal_entries.deleted_at')
            ->where('journal_entries.tenant_id', $tenantId)
            ->whereIn('journal_entries.status', $period->statuses())
            ->whereBetween('journal_entries.booking_date', [$period->from->toDateString(), $period->to->toDateString()])
            ->whereNotNull('journal_entry_lines.tax_key')
            ->whereNotIn('journal_entry_lines.tax_key', self::SUPPORTED_TAX_KEYS)
            ->selectRaw('journal_entry_lines.tax_key, count(*) as count')
            ->groupBy('journal_entry_lines.tax_key')
            ->get();

        if ($unsupportedTaxKeys->isNotEmpty()) {
            $blockers[] = [
                'code' => 'euer_unsupported_tax_key',
                'severity' => 'error',
                'message' => 'Nicht unterstützte Steuerfälle gefunden (z.B. Reverse Charge oder innergemeinschaftliche Sachverhalte).',
                'affected_count' => (int) $unsupportedTaxKeys->sum('count'),
                'drilldown' => $unsupportedTaxKeys->map(fn (object $row) => ['tax_key' => $row->tax_key, 'count' => (int) $row->count])->values()->all(),
            ];
        }

        return $blockers;
    }

    private function tenant(): Tenant
    {
        $tenant = app('currentTenant');
        if (! $tenant instanceof Tenant) {
            $tenant = Tenant::findOrFail($this->queries->tenantId());
        }

        return $tenant;
    }
}
