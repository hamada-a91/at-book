<?php

namespace Tests\Support;

use App\Models\BackupJob;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Backup\BackupExportService;
use App\Services\Backup\BackupImportService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

/**
 * Hilfsfunktionen für Backup-Tests: Export/Import synchron ausführen und
 * das ZIP-Format in ein diffbares Array (metadata/manifest/data) übersetzen
 * bzw. wieder zurückbauen. Wird von BackupRoundtripTest und dem
 * Fixture-Kompatibilitätstest genutzt.
 *
 * Rührt NICHTS an app/Services/Backup/ an – arbeitet ausschließlich über die
 * öffentliche API von BackupExportService/BackupImportService.
 */
class BackupTestHelper
{
    /**
     * Führt einen synchronen Export für den Tenant aus und liest das ZIP in
     * ein Array mit 'metadata', 'manifest' und 'data' (entityType => Zeilen)
     * ein.
     */
    public static function exportToArray(Tenant $tenant, User $user): array
    {
        /** @var BackupExportService $exportService */
        $exportService = app(BackupExportService::class);

        $job = $exportService->createExport($tenant, $user, ['include_files' => false]);
        $exportService->processExport($job);
        $job->refresh();

        $zipPath = Storage::disk('public')->path($job->file_path);

        $export = self::readZip($zipPath);
        $export['job'] = $job;
        $export['zip_path'] = $zipPath;

        return $export;
    }

    /**
     * Liest eine ZIP-Backup-Datei in ein Array mit 'metadata', 'manifest'
     * und 'data' (entityType => Zeilen) ein.
     */
    public static function readZip(string $zipPath): array
    {
        $zip = new ZipArchive;
        if ($zip->open($zipPath) !== true) {
            throw new \RuntimeException("Konnte ZIP nicht öffnen: {$zipPath}");
        }

        $metadata = json_decode($zip->getFromName('metadata.json'), true) ?? [];
        $manifest = json_decode($zip->getFromName('manifest.json'), true) ?? [];

        $data = [];
        foreach ($manifest['entities'] ?? [] as $entity) {
            $content = $zip->getFromName($entity['file']);
            $rows = [];
            foreach (preg_split('/\r?\n/', trim((string) $content)) as $line) {
                if ($line === '') {
                    continue;
                }
                $rows[] = json_decode($line, true);
            }
            $data[$entity['type']] = $rows;
        }

        $zip->close();

        return [
            'metadata' => $metadata,
            'manifest' => $manifest,
            'data' => $data,
        ];
    }

    /**
     * Baut aus einem Array (wie von exportToArray/readZip geliefert) wieder
     * eine importierbare ZIP-Datei und liefert den Pfad im Systemtemp.
     */
    public static function buildZip(array $export): string
    {
        $zipPath = sys_get_temp_dir().'/backup-fixture-'.uniqid().'.zip';

        $zip = new ZipArchive;
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException("Konnte ZIP nicht anlegen: {$zipPath}");
        }

        $zip->addFromString('metadata.json', json_encode($export['metadata'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $zip->addFromString('manifest.json', json_encode($export['manifest'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        foreach ($export['data'] as $entityType => $rows) {
            $ndjson = implode("\n", array_map(
                fn ($row) => json_encode($row, JSON_UNESCAPED_UNICODE),
                $rows
            ));
            $zip->addFromString("data/{$entityType}.ndjson", $ndjson);
        }

        $zip->close();

        return $zipPath;
    }

    /**
     * Importiert eine ZIP-Datei synchron in den Ziel-Tenant (Modus 'replace').
     */
    public static function importZip(string $zipPath, Tenant $tenant, User $user): BackupJob
    {
        /** @var BackupImportService $importService */
        $importService = app(BackupImportService::class);

        $uploaded = new UploadedFile($zipPath, basename($zipPath), 'application/zip', null, true);
        $job = $importService->uploadBackup($tenant, $user, $uploaded);
        $importService->processImport($job, 'replace');
        $job->refresh();

        return $job;
    }
}
