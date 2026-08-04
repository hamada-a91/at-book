<?php

namespace App\Jobs;

use App\Models\Beleg;
use App\Models\Tenant;
use App\Modules\Accounting\Models\AuditLog;
use App\Services\Ocr\DocumentExtractor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessBelegOcrJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 180;

    public function __construct(
        private readonly int $belegId,
        private readonly int $tenantId,
    ) {
        $this->onQueue('ocr');
    }

    public function middleware(): array
    {
        return [
            (new WithoutOverlapping("beleg-ocr-{$this->tenantId}-{$this->belegId}"))
                ->releaseAfter(60)
                ->expireAfter(300),
        ];
    }

    public function handle(DocumentExtractor $extractor): void
    {
        $tenant = Tenant::findOrFail($this->tenantId);
        app()->instance('currentTenant', $tenant);

        $beleg = Beleg::query()
            ->where('tenant_id', $tenant->id)
            ->findOrFail($this->belegId);

        try {
            Beleg::withoutEvents(fn () => $beleg->update([
                'ocr_status' => 'processing',
                'ocr_provider' => 'tesseract',
            ]));

            $data = $extractor->extract($beleg->fresh());

            DB::transaction(function () use ($beleg, $data) {
                $beleg->refresh();
                Beleg::withoutEvents(fn () => $beleg->update([
                    'ocr_status' => 'done',
                    'ocr_provider' => 'tesseract',
                    'ocr_data' => $data,
                ]));

                AuditLog::record(
                    $beleg,
                    'beleg_ocr_extracted',
                    ['ocr_status' => 'processing'],
                    [
                        'ocr_status' => 'done',
                        'ocr_provider' => 'tesseract',
                        'confidence' => $data['confidence'] ?? null,
                    ]
                );
            });
        } catch (\Throwable $exception) {
            Log::warning('Beleg OCR failed', [
                'beleg_id' => $this->belegId,
                'tenant_id' => $this->tenantId,
                'error' => $exception->getMessage(),
            ]);

            $beleg->refresh();
            Beleg::withoutEvents(fn () => $beleg->update([
                'ocr_status' => 'failed',
                'ocr_provider' => 'tesseract',
                'ocr_data' => [
                    'provider' => 'tesseract',
                    'error' => $exception->getMessage(),
                    'fields' => [],
                ],
            ]));
        }
    }
}
