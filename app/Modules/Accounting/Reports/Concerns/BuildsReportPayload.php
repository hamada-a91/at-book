<?php

namespace App\Modules\Accounting\Reports\Concerns;

use App\Modules\Accounting\Reports\ReportPeriod;

trait BuildsReportPayload
{
    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $totals
     * @param  array<string, mixed>  $quality
     * @param  array<string, mixed>  $legacy
     * @return array<string, mixed>
     */
    private function payload(string $type, ReportPeriod $period, array $data, array $totals, array $quality, array $legacy = []): array
    {
        return array_merge([
            'report_type' => $type,
            'basis' => $period->basis,
            'period' => $period->toArray(),
            'generated_at' => now()->toISOString(),
            'currency' => 'EUR',
            'data' => $data,
            'totals' => $totals,
            'quality' => $quality,
        ], $legacy);
    }
}
