<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateReportExportJob;
use App\Models\CompanySetting;
use App\Models\ReportExport;
use App\Modules\Accounting\Models\AuditLog;
use App\Modules\Accounting\Models\JournalEntryLine;
use App\Modules\Accounting\Reports\AccountMovementsReport;
use App\Modules\Accounting\Reports\BalanceSheetReport;
use App\Modules\Accounting\Reports\BwaReport;
use App\Modules\Accounting\Reports\EuerReport;
use App\Modules\Accounting\Reports\JournalReport;
use App\Modules\Accounting\Reports\ProfitLossReport;
use App\Modules\Accounting\Reports\ReportExportService;
use App\Modules\Accounting\Reports\ReportPeriod;
use App\Modules\Accounting\Reports\ReportQualityService;
use App\Modules\Accounting\Reports\TrialBalanceReport;
use App\Modules\Accounting\Reports\UstvaReport;
use App\Modules\Accounting\Reports\VatReport;
use App\Modules\Projects\Models\CostCenter;
use App\Modules\Projects\Models\Project;
use App\Modules\Projects\Services\ProjectReportService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Response;

/**
 * WICHTIG (GoBD/Generalumkehr): Stornierte Buchungen (status=cancelled) und ihre
 * Storno-Gegenbuchungen müssen BEIDE in alle Auswertungen einfließen - sie
 * neutralisieren sich zu 0. Ein Filter auf status != cancelled trifft nur das
 * Original und verfälscht alle Salden (Original und Storno sind nicht verknüpft).
 */
class ReportsController extends Controller
{
    public function trialBalance(Request $request): JsonResponse
    {
        return $this->show($request, 'trial-balance');
    }

    public function profitAndLoss(Request $request): JsonResponse
    {
        return $this->show($request, 'profit-loss');
    }

    public function balanceSheet(Request $request): JsonResponse
    {
        return $this->show($request, 'balance-sheet');
    }

    public function journalExport(Request $request): JsonResponse
    {
        return $this->show($request, 'journal');
    }

    public function accountMovements(Request $request): JsonResponse
    {
        return $this->show($request, 'account-movements');
    }

    public function taxReport(Request $request): JsonResponse
    {
        return $this->show($request, 'vat');
    }

    public function show(Request $request, string $type): JsonResponse
    {
        try {
            return response()->json($this->buildReport($this->canonicalType($type), $this->periodFromRequest($request, $this->canonicalType($type)), $request));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function export(Request $request, string $type, ReportExportService $exports): Response
    {
        try {
            $canonicalType = $this->canonicalType($type);
            $report = $this->buildReport($canonicalType, $this->periodFromRequest($request, $canonicalType), $request);

            return match ($request->input('format', 'pdf')) {
                'pdf' => $exports->pdf($report),
                'csv' => $exports->csv($report),
                default => response()->json(['message' => 'Ungültiges Exportformat.'], 422),
            };
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function transferSheet(Request $request, ReportExportService $exports): Response
    {
        try {
            $period = $this->periodFromRequest($request, 'ustva');
            $report = $this->buildReport('ustva', $period, $request);

            if (($report['quality']['blocking_errors'] ?? []) !== []) {
                return response()->json([
                    'message' => 'Der USt-VA-Übertragungsbogen ist wegen blockierender Qualitätsbefunde nicht freigegeben.',
                    'quality' => $report['quality'],
                ], 422);
            }

            if ($settings = CompanySetting::query()->first()) {
                AuditLog::record($settings, 'vat_transfer_sheet_generated', [], [
                    'period' => $report['period'],
                    'format' => $request->input('format', 'pdf'),
                ]);
            }

            return match ($request->input('format', 'pdf')) {
                'pdf' => $exports->pdf($report),
                'csv' => $exports->csv($report),
                default => response()->json(['message' => 'Ungültiges Exportformat.'], 422),
            };
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function euerTransferSheet(Request $request, ReportExportService $exports): Response
    {
        try {
            $period = $this->periodFromRequest($request, 'euer');
            $report = $this->buildReport('euer', $period, $request);

            if (($report['quality']['blocking_errors'] ?? []) !== []) {
                return response()->json([
                    'message' => 'Der EÜR-Übertragungsbogen ist wegen blockierender Qualitätsbefunde nicht freigegeben.',
                    'quality' => $report['quality'],
                ], 422);
            }

            if ($settings = CompanySetting::query()->first()) {
                AuditLog::record($settings, 'euer_transfer_sheet_generated', [], [
                    'period' => $report['period'],
                    'format' => $request->input('format', 'pdf'),
                ]);
            }

            return match ($request->input('format', 'pdf')) {
                'pdf' => $exports->pdf($report),
                'csv' => $exports->csv($report),
                default => response()->json(['message' => 'Ungültiges Exportformat.'], 422),
            };
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function quality(Request $request, ReportQualityService $quality): JsonResponse
    {
        try {
            $period = ReportPeriod::fromRequest($request);
            $type = $this->canonicalType($request->input('report_type', 'trial-balance'));

            return response()->json($quality->assess(str_replace('-', '_', $type), $period));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function buildReport(string $type, ReportPeriod $period, Request $request): array
    {
        return match ($type) {
            'trial-balance' => app(TrialBalanceReport::class)->generate($period),
            'profit-loss' => app(ProfitLossReport::class)->generate($period),
            'balance-sheet' => app(BalanceSheetReport::class)->generate($period),
            'bwa' => app(BwaReport::class)->generate($period),
            'ustva' => app(UstvaReport::class)->generate($period),
            'euer' => app(EuerReport::class)->generate($period),
            'journal' => app(JournalReport::class)->generate($period),
            'account-movements' => app(AccountMovementsReport::class)->generate($period, $request->integer('account_id') ?: null),
            'vat' => app(VatReport::class)->generate($period),
            default => throw new InvalidArgumentException('Unbekannter Berichtstyp.'),
        };
    }

    private function periodFromRequest(Request $request, string $type): ReportPeriod
    {
        if ($type === 'ustva' && $request->filled(['year', 'month'])) {
            $month = CarbonImmutable::create((int) $request->integer('year'), (int) $request->integer('month'), 1)->startOfDay();

            return new ReportPeriod($month, $month->endOfMonth()->startOfDay(), $request->input('basis', ReportPeriod::BASIS_POSTED));
        }

        return ReportPeriod::fromRequest($request);
    }

    private function canonicalType(string $type): string
    {
        return match ($type) {
            'trial-balance' => 'trial-balance',
            'profit-loss' => 'profit-loss',
            'balance-sheet' => 'balance-sheet',
            'bwa' => 'bwa',
            'journal', 'journal-export' => 'journal',
            'account-movements' => 'account-movements',
            'vat', 'tax-report' => 'vat',
            'ustva' => 'ustva',
            'euer' => 'euer',
            default => throw new InvalidArgumentException('Unbekannter Berichtstyp.'),
        };
    }

    /**
     * SPEC-08 (Teil A): GET /reports/projects/{project}/profitability - dünner
     * Wrapper um ProjectReportService::summary() unter dem /reports-Namespace
     * (Spec sieht sowohl /projects/{id}/summary als auch diesen Endpunkt vor;
     * beide liefern dieselben Daten, siehe ProjectController::summary()).
     */
    public function projectProfitability(Project $project, ProjectReportService $projectReportService): JsonResponse
    {
        return response()->json($projectReportService->summary($project));
    }

    /**
     * SPEC-08 (Teil A): GET /reports/cost-centers?from&to - Summen je
     * Kostenstelle (BAB-light: Erlöse, Kosten, Saldo je KOST1 im Zeitraum).
     * Reports-Prinzip: posted+cancelled einbeziehen, Storno-Paare
     * neutralisieren sich (siehe Klassen-Docblock).
     */
    public function costCenters(Request $request): JsonResponse
    {
        $fromDate = $request->input('from', $request->input('from_date'));
        $toDate = $request->input('to', $request->input('to_date'));

        $costCenters = CostCenter::where('active', true)->orderBy('code')->get();

        $data = $costCenters->map(function (CostCenter $costCenter) use ($fromDate, $toDate) {
            $lines = JournalEntryLine::with('account')
                ->where('cost_center_id', $costCenter->id)
                ->whereHas('journalEntry', function ($q) use ($fromDate, $toDate) {
                    $q->whereIn('status', ['posted', 'cancelled']);
                    if ($fromDate) {
                        $q->whereDate('booking_date', '>=', $fromDate);
                    }
                    if ($toDate) {
                        $q->whereDate('booking_date', '<=', $toDate);
                    }
                })
                ->get();

            $revenue = 0;
            $cost = 0;
            foreach ($lines as $line) {
                $accountType = $line->account?->type;
                if ($accountType === 'revenue') {
                    $revenue += ($line->type === 'credit' ? $line->amount : -$line->amount);
                } elseif ($accountType === 'expense') {
                    $cost += ($line->type === 'debit' ? $line->amount : -$line->amount);
                }
            }

            return [
                'cost_center_id' => $costCenter->id,
                'code' => $costCenter->code,
                'name' => $costCenter->name,
                'revenue' => $revenue,
                'cost' => $cost,
                'balance' => $revenue - $cost,
            ];
        })->filter(fn (array $row) => $row['revenue'] !== 0 || $row['cost'] !== 0)->values();

        return response()->json([
            'period' => ['from' => $fromDate, 'to' => $toDate],
            'data' => $data,
            'totals' => [
                'revenue' => $data->sum('revenue'),
                'cost' => $data->sum('cost'),
                'balance' => $data->sum('balance'),
            ],
        ]);
    }

    public function createExport(Request $request, string $type): JsonResponse
    {
        $request->validate([
            'format' => ['required', 'string', 'in:pdf,csv,xlsx'],
            'from_date' => ['nullable', 'date'],
            'to_date' => ['nullable', 'date'],
            'year' => ['nullable', 'integer'],
            'month' => ['nullable', 'integer'],
            'basis' => ['nullable', 'string', 'in:posted,preview'],
            'account_id' => [
                'nullable',
                'integer',
                Rule::exists('accounts', 'id')->where('tenant_id', tenant()->id),
            ],
        ]);

        $canonicalType = $this->canonicalType($type);
        $period = $this->periodFromRequest($request, $canonicalType);

        $export = ReportExport::create([
            'tenant_id' => tenant()->id,
            'report_type' => $canonicalType,
            'format' => $request->input('format'),
            'period_from' => $period->from->toDateString(),
            'period_to' => $period->to->toDateString(),
            'basis' => $period->basis,
            'params' => $request->only(['account_id', 'year', 'month']),
            'status' => 'pending',
            'created_by' => auth()->id(),
        ]);

        GenerateReportExportJob::dispatch($export);

        return response()->json([
            'public_id' => $export->public_id,
            'status' => $export->status,
        ], 202);
    }

    public function exportsIndex(): JsonResponse
    {
        $exports = ReportExport::orderBy('created_at', 'desc')->get();

        return response()->json($exports);
    }

    public function showExport(string $export): JsonResponse
    {
        $exportModel = ReportExport::where('public_id', $export)->firstOrFail();

        return response()->json($exportModel);
    }

    public function downloadExport(string $export)
    {
        $exportModel = ReportExport::where('public_id', $export)->firstOrFail();

        if (in_array($exportModel->status, ['pending', 'processing'], true)) {
            return response()->json(['message' => 'Der Export wird noch verarbeitet.'], 409);
        }

        if ($exportModel->status === 'failed') {
            return response()->json(['message' => 'Der Export ist fehlgeschlagen: '.$exportModel->error_message], 400);
        }

        if (! $exportModel->file_path || ! Storage::disk('local')->exists($exportModel->file_path) || ($exportModel->expires_at && $exportModel->expires_at->isPast())) {
            return response()->json(['message' => 'Die Exportdatei ist abgelaufen oder nicht verfügbar.'], 410);
        }

        return Storage::disk('local')->download($exportModel->file_path);
    }

    public function deleteExport(string $export): JsonResponse
    {
        $exportModel = ReportExport::where('public_id', $export)->firstOrFail();

        if ($exportModel->file_path) {
            Storage::disk('local')->delete($exportModel->file_path);
        }

        $exportModel->delete();

        return response()->json(null, 204);
    }
}
