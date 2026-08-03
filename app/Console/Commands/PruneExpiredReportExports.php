<?php

namespace App\Console\Commands;

use App\Models\ReportExport;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PruneExpiredReportExports extends Command
{
    protected $signature = 'reports:prune-exports';

    protected $description = 'Delete expired report export files and records';

    public function handle(): int
    {
        $expiredExports = ReportExport::withoutGlobalScopes()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->get();

        $count = 0;
        foreach ($expiredExports as $export) {
            if ($export->file_path) {
                Storage::disk('local')->delete($export->file_path);
            }
            $export->delete();
            $count++;
        }

        $this->info("✅ Expired report exports pruned successfully. Total: {$count}");

        return 0;
    }
}
