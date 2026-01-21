<?php

namespace App\Services\Backup;

use App\Models\BackupAuditLog;
use App\Models\BackupJob;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Backup\Transformers\EntityTransformerRegistry;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

class BackupExportService
{
    /**
     * Ordered list of entity types to export (respects dependencies).
     */
    public const ENTITY_ORDER = [
        'tenants',
        'users',
        'accounts',
        'tax_codes',
        'product_categories',
        'products',
        'contacts',
        'bank_accounts',
        'company_settings',
        'quotes',
        'quote_lines',
        'orders',
        'order_lines',
        'delivery_notes',
        'delivery_note_lines',
        'invoices',
        'invoice_lines',
        'belege',
        'beleg_lines',
        'journal_entries',
        'journal_entry_lines',
        'inventory_transactions',
        // Note: 'documents' excluded - uses morph relationship without direct tenant_id
    ];

    protected EntityTransformerRegistry $transformerRegistry;
    protected string $disk = 'public';
    protected string $backupPath = 'backups';

    public function __construct(EntityTransformerRegistry $transformerRegistry)
    {
        $this->transformerRegistry = $transformerRegistry;
    }

    /**
     * Create a new export job.
     */
    public function createExport(Tenant $tenant, User $user, array $options = []): BackupJob
    {
        $job = BackupJob::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'type' => BackupJob::TYPE_EXPORT,
            'status' => BackupJob::STATUS_PENDING,
            'options' => array_merge([
                'include_files' => true,
                'compression_level' => 6,
            ], $options),
        ]);

        BackupAuditLog::log(BackupAuditLog::ACTION_EXPORT_STARTED, $job, [
            'options' => $job->options,
        ]);

        return $job;
    }

    /**
     * Process the export job.
     */
    public function processExport(BackupJob $job): void
    {
        try {
            $job->markAsProcessing('Initializing export...');

            $tenant = $job->tenant;
            $tempDir = $this->createTempDirectory($job);
            $stats = [];

            // Create metadata.json
            $job->updateProgress(5, 'Creating metadata...');
            $metadata = $this->createMetadata($tenant, $job);
            file_put_contents("{$tempDir}/metadata.json", json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            // Create data directory
            $dataDir = "{$tempDir}/data";
            mkdir($dataDir, 0755, true);

            // Export each entity type
            $totalEntities = count(self::ENTITY_ORDER);
            $currentEntity = 0;

            foreach (self::ENTITY_ORDER as $entityType) {
                $currentEntity++;
                $progress = 5 + (int)(($currentEntity / $totalEntities) * 70);
                $job->updateProgress($progress, "Exporting {$entityType}...");

                $count = $this->exportEntityType($entityType, $tenant, $dataDir);
                $stats[$entityType] = $count;
            }

            // Export files if enabled
            if ($job->options['include_files'] ?? true) {
                $job->updateProgress(80, 'Exporting files...');
                $fileStats = $this->exportFiles($tenant, $tempDir);
                $stats['files'] = $fileStats['count'];
            }

            // Create manifest.json
            $job->updateProgress(90, 'Creating manifest...');
            $manifest = $this->createManifest($tempDir, $stats);
            file_put_contents("{$tempDir}/manifest.json", json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            // Create ZIP archive
            $job->updateProgress(95, 'Creating ZIP archive...');
            $zipPath = $this->createZipArchive($job, $tempDir);

            // Calculate checksum
            $checksum = hash_file('sha256', $zipPath);
            $fileSize = filesize($zipPath);

            // Move to permanent storage
            $storagePath = $this->moveToStorage($job, $zipPath);

            // Cleanup temp directory
            $this->removeTempDirectory($tempDir);

            // Mark as completed
            $job->markAsCompleted($storagePath, $fileSize, $checksum, $stats);

            BackupAuditLog::log(BackupAuditLog::ACTION_EXPORT_COMPLETED, $job, [
                'file_size' => $fileSize,
                'stats' => $stats,
            ]);

        } catch (\Throwable $e) {
            $job->markAsFailed($e->getMessage(), [
                'exception' => get_class($e),
                'trace' => $e->getTraceAsString(),
            ]);

            BackupAuditLog::log(BackupAuditLog::ACTION_EXPORT_FAILED, $job, [
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Export a single entity type to an NDJSON file.
     */
    protected function exportEntityType(string $entityType, Tenant $tenant, string $dataDir): int
    {
        $transformer = $this->transformerRegistry->getTransformer($entityType);
        
        if (!$transformer) {
            return 0;
        }

        $filePath = "{$dataDir}/{$entityType}.ndjson";
        $handle = fopen($filePath, 'w');
        $count = 0;

        // Use cursor for memory efficiency
        $query = $transformer->getQuery($tenant);
        
        foreach ($query->cursor() as $model) {
            $data = $transformer->transform($model);
            fwrite($handle, json_encode($data, JSON_UNESCAPED_UNICODE) . "\n");
            $count++;
        }

        fclose($handle);

        // Remove empty files
        if ($count === 0) {
            unlink($filePath);
        }

        return $count;
    }

    /**
     * Export files/uploads associated with the tenant.
     */
    protected function exportFiles(Tenant $tenant, string $tempDir): array
    {
        $filesDir = "{$tempDir}/files";
        mkdir($filesDir, 0755, true);

        $fileManifest = [];
        $count = 0;

        // Get all Beleg files
        $belege = \App\Models\Beleg::where('tenant_id', $tenant->id)
            ->whereNotNull('file_path')
            ->cursor();

        foreach ($belege as $beleg) {
            if ($beleg->file_path && Storage::disk($this->disk)->exists($beleg->file_path)) {
                $relativePath = "belege/{$beleg->public_id}/" . basename($beleg->file_path);
                $targetPath = "{$filesDir}/{$relativePath}";
                
                // Create directory if needed
                $targetDir = dirname($targetPath);
                if (!is_dir($targetDir)) {
                    mkdir($targetDir, 0755, true);
                }

                // Copy file
                $content = Storage::disk($this->disk)->get($beleg->file_path);
                file_put_contents($targetPath, $content);

                $fileManifest[] = [
                    'path' => "files/{$relativePath}",
                    'original_path' => $beleg->file_path,
                    'disk' => $this->disk, // Store disk for proper restoration
                    'size' => strlen($content),
                    'checksum' => 'sha256:' . hash('sha256', $content),
                    'entity_type' => 'beleg',
                    'entity_public_id' => $beleg->public_id,
                ];
                $count++;
            }
        }

        // Get all Document files through morph relationships
        // Documents are linked to JournalEntries which belong to the tenant
        try {
            $journalEntryIds = \App\Modules\Accounting\Models\JournalEntry::where('tenant_id', $tenant->id)
                ->pluck('id');
            
            $documents = \Illuminate\Support\Facades\DB::table('documents')
                ->where('documentable_type', 'App\\Modules\\Accounting\\Models\\JournalEntry')
                ->whereIn('documentable_id', $journalEntryIds)
                ->cursor();

            foreach ($documents as $document) {
                $filePath = $document->path;
                if ($filePath && Storage::disk($this->disk)->exists($filePath)) {
                    $relativePath = "documents/{$document->id}/" . basename($filePath);
                    $targetPath = "{$filesDir}/{$relativePath}";
                    
                    $targetDir = dirname($targetPath);
                    if (!is_dir($targetDir)) {
                        mkdir($targetDir, 0755, true);
                    }

                    $content = Storage::disk($this->disk)->get($filePath);
                    file_put_contents($targetPath, $content);

                    $fileManifest[] = [
                        'path' => "files/{$relativePath}",
                        'original_path' => $filePath,
                        'disk' => $this->disk, // Store disk for proper restoration
                        'size' => strlen($content),
                        'checksum' => 'sha256:' . hash('sha256', $content),
                        'entity_type' => 'document',
                        'entity_id' => $document->id,
                        'documentable_type' => $document->documentable_type,
                        'documentable_id' => $document->documentable_id,
                    ];
                    $count++;
                }
            }
        } catch (\Exception $e) {
            // Skip document export if there's an issue - documents are optional
        }

        // Store file manifest for later use in main manifest
        file_put_contents("{$tempDir}/.file_manifest.json", json_encode($fileManifest));

        return ['count' => $count, 'manifest' => $fileManifest];
    }

    /**
     * Create metadata.json content.
     */
    protected function createMetadata(Tenant $tenant, BackupJob $job): array
    {
        return [
            'backup_version' => '1.0',
            'app_name' => config('app.name', 'AT-Book'),
            'app_version' => config('app.version', '1.0.0'),
            'created_at' => now()->toIso8601String(),
            'tenant_public_id' => $tenant->public_id,
            'tenant_name' => $tenant->name,
            'schema_version' => $this->getSchemaVersion(),
            'checksum_algo' => 'sha256',
            'signature' => null, // Can be added later for HMAC signing
            'options' => $job->options,
            'created_by' => [
                'public_id' => $job->user?->public_id,
                'email' => $job->user?->email,
            ],
        ];
    }

    /**
     * Create manifest.json content.
     */
    protected function createManifest(string $tempDir, array $stats): array
    {
        $entities = [];
        $dataDir = "{$tempDir}/data";

        foreach (self::ENTITY_ORDER as $entityType) {
            $filePath = "{$dataDir}/{$entityType}.ndjson";
            if (file_exists($filePath)) {
                $entities[] = [
                    'type' => $entityType,
                    'file' => "data/{$entityType}.ndjson",
                    'count' => $stats[$entityType] ?? 0,
                    'checksum' => 'sha256:' . hash_file('sha256', $filePath),
                ];
            }
        }

        $files = [];
        $fileManifestPath = "{$tempDir}/.file_manifest.json";
        if (file_exists($fileManifestPath)) {
            $files = json_decode(file_get_contents($fileManifestPath), true) ?: [];
            unlink($fileManifestPath); // Clean up temp file
        }

        $totalEntities = array_sum(array_map(fn($e) => $e['count'], $entities));

        return [
            'entities' => $entities,
            'files' => $files,
            'total_entities' => $totalEntities,
            'total_files' => count($files),
        ];
    }

    /**
     * Create the ZIP archive.
     */
    protected function createZipArchive(BackupJob $job, string $tempDir): string
    {
        $zipPath = sys_get_temp_dir() . '/backup_' . $job->public_id . '.zip';
        
        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException("Cannot create ZIP archive at {$zipPath}");
        }

        $this->addDirectoryToZip($zip, $tempDir, '');
        
        $zip->close();

        return $zipPath;
    }

    /**
     * Recursively add a directory to a ZIP archive.
     */
    protected function addDirectoryToZip(ZipArchive $zip, string $directory, string $prefix): void
    {
        $files = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $file) {
            if (!$file->isDir()) {
                $filePath = $file->getRealPath();
                $relativePath = $prefix . substr($filePath, strlen($directory) + 1);
                $zip->addFile($filePath, $relativePath);
            }
        }
    }

    /**
     * Move the ZIP file to permanent storage.
     */
    protected function moveToStorage(BackupJob $job, string $tempZipPath): string
    {
        $tenant = $job->tenant;
        $filename = sprintf(
            'backup_%s_%s.zip',
            $tenant->slug ?? $tenant->public_id,
            now()->format('Y-m-d_His')
        );
        
        $storagePath = "{$this->backupPath}/{$tenant->id}/{$filename}";
        
        Storage::disk($this->disk)->put($storagePath, file_get_contents($tempZipPath));
        
        // Clean up temp file
        unlink($tempZipPath);

        return $storagePath;
    }

    /**
     * Create a temporary directory for the export.
     */
    protected function createTempDirectory(BackupJob $job): string
    {
        $tempDir = sys_get_temp_dir() . '/at-book-backup-' . $job->public_id;
        
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        return $tempDir;
    }

    /**
     * Remove the temporary directory.
     */
    protected function removeTempDirectory(string $tempDir): void
    {
        if (!is_dir($tempDir)) {
            return;
        }

        $files = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($tempDir, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($files as $file) {
            if ($file->isDir()) {
                rmdir($file->getRealPath());
            } else {
                unlink($file->getRealPath());
            }
        }

        rmdir($tempDir);
    }

    /**
     * Get a hash representing the current schema version.
     */
    protected function getSchemaVersion(): string
    {
        $migrationPath = database_path('migrations');
        $migrations = glob("{$migrationPath}/*.php");
        sort($migrations);
        
        $migrationNames = array_map('basename', $migrations);
        
        return substr(md5(implode(',', $migrationNames)), 0, 12);
    }

    /**
     * Get the download path for a completed export.
     */
    public function getDownloadPath(BackupJob $job): ?string
    {
        if ($job->status !== BackupJob::STATUS_COMPLETED || !$job->file_path) {
            return null;
        }

        return $job->file_path;
    }

    /**
     * Delete a backup file.
     */
    public function deleteBackup(BackupJob $job): bool
    {
        if ($job->file_path && Storage::disk($this->disk)->exists($job->file_path)) {
            Storage::disk($this->disk)->delete($job->file_path);
        }

        $job->delete();

        return true;
    }
}
