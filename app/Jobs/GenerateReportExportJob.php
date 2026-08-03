<?php

namespace App\Jobs;

use App\Models\ReportExport;
use App\Models\Tenant;
use App\Modules\Accounting\Reports\AccountMovementsReport;
use App\Modules\Accounting\Reports\BalanceSheetReport;
use App\Modules\Accounting\Reports\BwaReport;
use App\Modules\Accounting\Reports\EuerReport;
use App\Modules\Accounting\Reports\JournalReport;
use App\Modules\Accounting\Reports\ProfitLossReport;
use App\Modules\Accounting\Reports\ReportExportService;
use App\Modules\Accounting\Reports\ReportPeriod;
use App\Modules\Accounting\Reports\TrialBalanceReport;
use App\Modules\Accounting\Reports\UstvaReport;
use App\Modules\Accounting\Reports\VatReport;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Throwable;

class GenerateReportExportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    /**
     * Create a new job instance.
     */
    public function __construct(protected ReportExport $reportExport)
    {
        $this->onQueue('default');
    }

    /**
     * Execute the job.
     */
    public function handle(ReportExportService $exportService): void
    {
        try {
            $this->reportExport->update(['status' => 'processing']);

            // Explicitly set Tenant context
            $tenant = Tenant::findOrFail($this->reportExport->tenant_id);
            app()->instance('currentTenant', $tenant);

            $period = new ReportPeriod(
                CarbonImmutable::parse($this->reportExport->period_from),
                CarbonImmutable::parse($this->reportExport->period_to),
                $this->reportExport->basis ?? ReportPeriod::BASIS_POSTED
            );

            $type = $this->reportExport->report_type;

            $report = match ($type) {
                'trial-balance' => app(TrialBalanceReport::class)->generate($period),
                'profit-loss' => app(ProfitLossReport::class)->generate($period),
                'balance-sheet' => app(BalanceSheetReport::class)->generate($period),
                'bwa' => app(BwaReport::class)->generate($period),
                'ustva' => app(UstvaReport::class)->generate($period),
                'euer' => app(EuerReport::class)->generate($period),
                'journal' => app(JournalReport::class)->generate($period),
                'account-movements' => app(AccountMovementsReport::class)->generate(
                    $period,
                    isset($this->reportExport->params['account_id']) ? (int) $this->reportExport->params['account_id'] : null
                ),
                'vat' => app(VatReport::class)->generate($period),
                default => throw new \InvalidArgumentException('Unbekannter Berichtstyp.'),
            };

            // Check blocking quality gates for tax reports
            if (in_array($type, ['ustva', 'euer'], true)) {
                if (! empty($report['quality']['blocking_errors'])) {
                    $messages = collect($report['quality']['blocking_errors'])->pluck('message')->implode('; ');
                    throw new \RuntimeException('Export blockiert wegen Qualitätsbefunden: '.$messages);
                }
            }

            // Generate raw content based on format
            $format = strtolower($this->reportExport->format);
            $content = match ($format) {
                'pdf' => $exportService->getPdfContent($report),
                'csv' => $exportService->getCsvContent($report),
                'xlsx' => $exportService->getXlsxContent($report),
                default => throw new \InvalidArgumentException('Ungültiges Exportformat.'),
            };

            // Save to tenant-partitioned storage
            $filePath = sprintf('report-exports/%d/%s.%s', $tenant->id, $this->reportExport->public_id, $format);
            Storage::disk('local')->put($filePath, $content);

            $this->reportExport->update([
                'status' => 'ready',
                'file_path' => $filePath,
                'file_size' => strlen($content),
                'expires_at' => now()->addDays(30),
                'error_message' => null,
            ]);

        } catch (Throwable $e) {
            $this->reportExport->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);
        }
    }
}
