<?php

namespace App\Services\Backup;

use App\Models\BackupAuditLog;
use App\Models\BackupJob;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Backup\DTO\ImportIdMapping;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

class BackupImportService
{
    /**
     * Ordered list of entity types to import (respects dependencies).
     */
    public const ENTITY_ORDER = [
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

    protected string $disk = 'public';
    protected string $uploadPath = 'backup_uploads';
    protected BackupExportService $exportService;

    public function __construct(BackupExportService $exportService)
    {
        $this->exportService = $exportService;
    }

    /**
     * Handle file upload for import.
     */
    public function uploadBackup(Tenant $tenant, User $user, $file): BackupJob
    {
        $filename = sprintf(
            'import_%s_%s.zip',
            $tenant->public_id,
            now()->format('Y-m-d_His')
        );
        
        $path = "{$this->uploadPath}/{$tenant->id}/{$filename}";
        Storage::disk($this->disk)->put($path, file_get_contents($file->getRealPath()));

        $job = BackupJob::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'type' => BackupJob::TYPE_IMPORT,
            'status' => BackupJob::STATUS_PENDING,
            'file_path' => $path,
            'file_size' => $file->getSize(),
            'checksum' => hash_file('sha256', $file->getRealPath()),
        ]);

        BackupAuditLog::log(BackupAuditLog::ACTION_IMPORT_UPLOADED, $job, [
            'file_size' => $file->getSize(),
            'original_name' => $file->getClientOriginalName(),
        ]);

        return $job;
    }

    /**
     * Validate an uploaded backup without importing.
     */
    public function validateBackup(BackupJob $job): array
    {
        $errors = [];
        $warnings = [];
        $info = [];

        $zipPath = Storage::disk($this->disk)->path($job->file_path);

        // Check if file exists
        if (!file_exists($zipPath)) {
            return ['valid' => false, 'errors' => ['Backup-Datei nicht gefunden']];
        }

        $zip = new ZipArchive();
        if ($zip->open($zipPath) !== true) {
            return ['valid' => false, 'errors' => ['ZIP-Datei konnte nicht geöffnet werden']];
        }

        // Check for metadata.json
        $metadataContent = $zip->getFromName('metadata.json');
        if ($metadataContent === false) {
            $errors[] = 'metadata.json fehlt im Backup';
        } else {
            $metadata = json_decode($metadataContent, true);
            if (!$metadata) {
                $errors[] = 'metadata.json ist ungültig';
            } else {
                $info['backup_version'] = $metadata['backup_version'] ?? 'unknown';
                $info['app_version'] = $metadata['app_version'] ?? 'unknown';
                $info['created_at'] = $metadata['created_at'] ?? 'unknown';
                $info['tenant_name'] = $metadata['tenant_name'] ?? 'unknown';
                $info['tenant_public_id'] = $metadata['tenant_public_id'] ?? 'unknown';
                $info['counts'] = $metadata['counts'] ?? [];

                // Check tenant match - WARNING only (allows disaster recovery/migration)
                $tenant = $job->tenant;
                $info['is_cross_tenant'] = false;
                if (isset($metadata['tenant_public_id']) && $metadata['tenant_public_id'] !== $tenant->public_id) {
                    $info['is_cross_tenant'] = true;
                    $warnings[] = sprintf(
                        '⚠️ CROSS-TENANT IMPORT: Dieses Backup wurde für einen anderen Tenant erstellt ("%s"). Die Daten werden in Ihren aktuellen Tenant "%s" importiert. Alle Referenzen werden neu zugeordnet.',
                        $metadata['tenant_name'] ?? $metadata['tenant_public_id'],
                        $tenant->name
                    );
                }

                // Check schema version
                $currentSchema = $this->getSchemaVersion();
                if (isset($metadata['schema_version']) && $metadata['schema_version'] !== $currentSchema) {
                    $warnings[] = sprintf(
                        'Schema-Version unterscheidet sich (%s vs %s)',
                        $metadata['schema_version'],
                        $currentSchema
                    );
                }
            }
        }

        // Check for manifest.json
        $manifestContent = $zip->getFromName('manifest.json');
        if ($manifestContent === false) {
            $errors[] = 'manifest.json fehlt im Backup';
        } else {
            $manifest = json_decode($manifestContent, true);
            if ($manifest) {
                $info['total_entities'] = $manifest['total_entities'] ?? 0;
                $info['total_files'] = $manifest['total_files'] ?? 0;
            }
        }

        // Path traversal check
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (strpos($name, '..') !== false || strpos($name, '//') !== false) {
                $errors[] = "Ungültiger Dateipfad im ZIP: {$name}";
            }
        }

        $zip->close();

        $valid = empty($errors);

        if ($valid) {
            BackupAuditLog::log(BackupAuditLog::ACTION_IMPORT_VALIDATED, $job, [
                'info' => $info,
                'warnings' => $warnings,
            ]);
        }

        return [
            'valid' => $valid,
            'errors' => $errors,
            'warnings' => $warnings,
            'info' => $info,
        ];
    }

    /**
     * Process the import job.
     * IMPORTANT: Delete + Import is wrapped in a transaction for atomicity.
     */
    public function processImport(BackupJob $job, string $mode = 'replace'): void
    {
        $extractDir = null;
        
        try {
            $job->markAsProcessing('Initializing import...');
            $job->update(['options' => ['import_mode' => $mode]]);

            $tenant = $job->tenant;
            $zipPath = Storage::disk($this->disk)->path($job->file_path);

            // Create pre-restore backup BEFORE the transaction
            // (so it's preserved even if we rollback)
            if ($mode === 'replace') {
                $job->updateProgress(5, 'Creating pre-restore backup...');
                $this->createPreRestoreBackup($tenant, $job);
            }

            // Extract ZIP BEFORE the transaction
            $job->updateProgress(10, 'Extracting backup...');
            $extractDir = $this->extractZip($zipPath, $job);

            // Load manifest and metadata
            $manifest = json_decode(file_get_contents("{$extractDir}/manifest.json"), true);
            $metadata = json_decode(file_get_contents("{$extractDir}/metadata.json"), true);
            
            // Update progress before transaction starts
            $job->updateProgress(15, 'Starting data import (atomic transaction)...');
            
            // ============================================================
            // START TRANSACTION - Delete + Import must be atomic!
            // If import fails, rollback to preserve original data.
            // NOTE: No progress updates inside transaction (PostgreSQL issue)
            // ============================================================
            // Get the user who initiated the import - this is the user we need to preserve
            $importingUser = $job->user;
            $importingUserId = $job->user_id;
            
            // Detect cross-tenant import from METADATA (not manifest - metadata has tenant info)
            $isCrossTenant = false;
            if (isset($metadata['tenant_public_id']) && $metadata['tenant_public_id'] !== $tenant->public_id) {
                $isCrossTenant = true;
                \Log::info("Import: CROSS-TENANT import detected. Source tenant: {$metadata['tenant_public_id']}, Target tenant: {$tenant->public_id}");
            }
            
            $stats = DB::transaction(function () use ($tenant, $extractDir, $mode, $importingUser, $importingUserId, $isCrossTenant) {
                $idMapping = new ImportIdMapping();
                $stats = [];

                if ($mode === 'replace') {
                    // Delete existing data (inside transaction - will rollback on failure)
                    // Pass the importing user ID to preserve them
                    $this->deleteExistingData($tenant, $importingUserId);
                }

                // Import entities
                foreach (self::ENTITY_ORDER as $entityType) {
                    $ndjsonPath = "{$extractDir}/data/{$entityType}.ndjson";
                    if (file_exists($ndjsonPath)) {
                        $count = $this->importEntityType($entityType, $ndjsonPath, $tenant, $idMapping, $importingUser, $isCrossTenant);
                        $stats[$entityType] = $count;
                    }
                }

                return $stats;
            });
            // ============================================================
            // END TRANSACTION - At this point, all changes are committed
            // ============================================================
            
            // Update progress after successful transaction
            $job->updateProgress(80, 'Data imported successfully. Restoring files...');

            // Import files (outside transaction - file operations can't be rolled back)
            $filesDir = "{$extractDir}/files";
            if (is_dir($filesDir)) {
                $job->updateProgress(85, 'Restoring files...');
                $filesManifest = $manifest['files'] ?? [];
                $restoredCount = $this->importFiles($filesDir, $filesManifest);
                $stats['files_restored'] = $restoredCount;
                $stats['files_total'] = count($filesManifest);
            }

            // Cleanup
            $job->updateProgress(95, 'Cleaning up...');
            $this->removeTempDirectory($extractDir);

            // Mark as completed
            $job->markAsCompleted(null, null, null, $stats);

            BackupAuditLog::log(BackupAuditLog::ACTION_IMPORT_COMPLETED, $job, [
                'stats' => $stats,
                'mode' => $mode,
            ]);

        } catch (\Throwable $e) {
            // Clean up temp directory on failure
            if ($extractDir && is_dir($extractDir)) {
                $this->removeTempDirectory($extractDir);
            }
            
            $job->markAsFailed($e->getMessage(), [
                'exception' => get_class($e),
                'trace' => $e->getTraceAsString(),
            ]);

            BackupAuditLog::log(BackupAuditLog::ACTION_IMPORT_FAILED, $job, [
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Create a pre-restore backup.
     */
    protected function createPreRestoreBackup(Tenant $tenant, BackupJob $importJob): BackupJob
    {
        $preBackupJob = $this->exportService->createExport($tenant, $importJob->user, [
            'include_files' => true,
            'is_pre_restore' => true,
        ]);

        // Process synchronously
        $this->exportService->processExport($preBackupJob);

        BackupAuditLog::log(BackupAuditLog::ACTION_PRE_RESTORE_BACKUP, $preBackupJob, [
            'import_job_id' => $importJob->public_id,
        ]);

        return $preBackupJob;
    }

    /**
     * Delete all existing data for the tenant.
     * Note: Some "line" tables don't have tenant_id - they rely on their parent tables.
     * IMPORTANT: This method is called inside a transaction, so don't create a nested transaction.
     * 
     * @param Tenant $tenant The tenant to delete data for
     * @param int|null $preserveUserId The user ID to preserve (the importing user)
     */
    protected function deleteExistingData(Tenant $tenant, ?int $preserveUserId = null): void
    {
        // Define which entity types have direct tenant_id and which are child tables
        $directTenantTables = [
            'users', 'accounts', 'tax_codes', 'product_categories', 'products',
            'contacts', 'bank_accounts', 'company_settings', 'quotes', 'orders',
            'delivery_notes', 'invoices', 'belege', 'journal_entries', 'inventory_transactions',
        ];
        
        // Child tables that need to be deleted via their parent relationship
        $childTables = [
            'quote_lines' => ['parent_table' => 'quotes', 'foreign_key' => 'quote_id'],
            'order_lines' => ['parent_table' => 'orders', 'foreign_key' => 'order_id'],
            'delivery_note_lines' => ['parent_table' => 'delivery_notes', 'foreign_key' => 'delivery_note_id'],
            'invoice_lines' => ['parent_table' => 'invoices', 'foreign_key' => 'invoice_id'],
            'beleg_lines' => ['parent_table' => 'belege', 'foreign_key' => 'beleg_id'],
            'journal_entry_lines' => ['parent_table' => 'journal_entries', 'foreign_key' => 'journal_entry_id'],
        ];

        // First delete child tables (that don't have tenant_id)
        foreach ($childTables as $childTable => $config) {
            $parentTable = $config['parent_table'];
            $foreignKey = $config['foreign_key'];
            
            // Get parent IDs for this tenant, then delete child records
            $parentIds = DB::table($parentTable)
                ->where('tenant_id', $tenant->id)
                ->pluck('id');
            
            if ($parentIds->isNotEmpty()) {
                DB::table($childTable)->whereIn($foreignKey, $parentIds)->delete();
            }
        }

        // Now delete parent tables with direct tenant_id (in reverse order for FK)
        $deleteOrder = array_reverse($directTenantTables);

        // Use the passed-in user ID to preserve (instead of auth()->id() which may be null in job context)
        $currentUserId = $preserveUserId ?? auth()->id();

        foreach ($deleteOrder as $entityType) {
            $modelClass = $this->getModelClass($entityType);
            if ($modelClass && class_exists($modelClass)) {
                try {
                    // Get the table name from the model
                    $tableName = (new $modelClass)->getTable();
                    
                    // Build the delete query
                    $deleteQuery = DB::table($tableName)->where('tenant_id', $tenant->id);
                    
                    // Don't delete the current user - they need to stay logged in
                    if ($entityType === 'users' && $currentUserId) {
                        $deleteQuery = $deleteQuery->where('id', '!=', $currentUserId);
                    }

                    // Use raw DB delete to permanently remove ALL records including soft-deleted ones
                    // This bypasses soft-delete and ensures no duplicate public_id conflicts during import
                    $deleted = $deleteQuery->delete();
                    
                    \Log::info("Delete before import: {$entityType} - {$deleted} records permanently deleted");
                } catch (\Exception $e) {
                    // Log but continue - some tables might have FK constraints
                    \Log::warning("Could not delete {$entityType}: " . $e->getMessage());
                }
            }
        }
    }

    /**
     * Extract the ZIP file.
     */
    protected function extractZip(string $zipPath, BackupJob $job): string
    {
        $extractDir = sys_get_temp_dir() . '/at-book-import-' . $job->public_id;

        if (!is_dir($extractDir)) {
            mkdir($extractDir, 0755, true);
        }

        $zip = new ZipArchive();
        if ($zip->open($zipPath) !== true) {
            throw new \RuntimeException('Could not open ZIP file');
        }

        $zip->extractTo($extractDir);
        $zip->close();

        return $extractDir;
    }

    /**
     * Import a single entity type from NDJSON.
     * 
     * @param string $entityType The entity type to import
     * @param string $ndjsonPath Path to the NDJSON file
     * @param Tenant $tenant The tenant to import into
     * @param ImportIdMapping $idMapping The ID mapping object
     * @param User|null $importingUser The user who initiated the import (to preserve them)
     * @param bool $isCrossTenant Whether this is a cross-tenant import (generates new public_ids)
     */
    protected function importEntityType(
        string $entityType,
        string $ndjsonPath,
        Tenant $tenant,
        ImportIdMapping $idMapping,
        ?\App\Models\User $importingUser = null,
        bool $isCrossTenant = false
    ): int {
        // Skip tenants - we use the current tenant, not the one from the backup
        if ($entityType === 'tenants') {
            // Just read the tenant's public_id and map it to current tenant
            $handle = fopen($ndjsonPath, 'r');
            while (($line = fgets($handle)) !== false) {
                $data = json_decode(trim($line), true);
                if ($data && isset($data['public_id'])) {
                    $idMapping->set('tenants', $data['public_id'], $tenant->id);
                }
            }
            fclose($handle);
            return 1; // Count as imported for stats
        }
        
        $modelClass = $this->getModelClass($entityType);
        if (!$modelClass || !class_exists($modelClass)) {
            \Log::warning("Import: No model class for {$entityType}");
            return 0;
        }

        // Child tables that don't have tenant_id
        $childTables = [
            'quote_lines', 'order_lines', 'delivery_note_lines',
            'invoice_lines', 'beleg_lines', 'journal_entry_lines',
        ];
        $isChildTable = in_array($entityType, $childTables);

        $handle = fopen($ndjsonPath, 'r');
        $count = 0;

        while (($line = fgets($handle)) !== false) {
            $line = trim($line);
            if (empty($line)) continue;

            $data = json_decode($line, true);
            if (!$data) continue;

            $publicId = $data['public_id'] ?? null;
            unset($data['public_id']);

            // Map foreign keys
            $data = $this->mapForeignKeys($entityType, $data, $idMapping);

            // Add tenant_id only for tables that have it
            if (!$isChildTable) {
                $data['tenant_id'] = $tenant->id;
            }

            // Handle special cases
            $data = $this->prepareForInsert($entityType, $data);
            
            // Set public_id in the data array BEFORE creating model
            // For SAME-TENANT imports: preserve the original public_id
            // For CROSS-TENANT imports: let the model generate a new UUID (avoids unique constraint violations)
            if ($publicId && !$isCrossTenant) {
                $data['public_id'] = $publicId;
            } elseif ($isCrossTenant) {
                // For cross-tenant, generate a new UUID
                $data['public_id'] = (string) \Illuminate\Support\Str::uuid();
                \Log::debug("Import: Cross-tenant - generating new public_id for {$entityType}");
            }

            // Special handling for users - preserve the importing user completely and handle existing users
            if ($entityType === 'users') {
                // Use the importing user (from job) instead of auth()->user() which may be null in job context
                $currentUser = $importingUser ?? auth()->user();
                $currentUserId = $currentUser?->id ?? auth()->id();
                
                // If this is the importing user (the one performing the restore), skip entirely but map their ID
                if ($currentUser && isset($data['email']) && $data['email'] === $currentUser->email) {
                    if ($publicId) {
                        $idMapping->set($entityType, $publicId, $currentUserId);
                    }
                    \Log::info("Import: Skipping importing user {$currentUser->email} to preserve session and permissions");
                    continue;
                }
                
                // Check if user with this email already exists
                if (isset($data['email'])) {
                    $existingUser = \App\Models\User::where('email', $data['email'])->first();
                    if ($existingUser) {
                        // Map the public_id to the existing user's ID
                        if ($publicId) {
                            $idMapping->set($entityType, $publicId, $existingUser->id);
                        }
                        \Log::info("Import: Skipping existing user {$data['email']}");
                        continue; // Skip creating/modifying this user
                    }
                }
            }

            // Create or update the model without events and without mass assignment protection
            try {
                $model = $modelClass::withoutEvents(function () use ($modelClass, $data, $publicId, $entityType, $isChildTable, $tenant, $importingUser, $isCrossTenant) {
                    // Temporarily disable mass assignment protection
                    $modelClass::unguard();
                    
                    $model = null;
                    
                    // For CROSS-TENANT imports: always create new records (skip lookup)
                    // For SAME-TENANT imports: check if a record with this public_id already exists
                    if (!$isCrossTenant && $publicId) {
                        // Check if a record with this public_id already exists in THIS TENANT (including soft-deleted)
                        $query = $modelClass::withoutGlobalScopes();
                        if (method_exists($modelClass, 'withTrashed')) {
                            $query = $modelClass::withTrashed()->withoutGlobalScopes();
                        }
                        $query = $query->where('public_id', $publicId);
                        
                        // Filter by tenant_id for non-child tables
                        if (!$isChildTable) {
                            $query = $query->where('tenant_id', $tenant->id);
                        }
                        
                        $model = $query->first();
                    }
                    
                    // SAFETY: Never modify the importing user
                    $importingUserId = $importingUser?->id ?? auth()->id();
                    if ($entityType === 'users' && $model && $model->id === $importingUserId) {
                        \Log::info("Import: Skipping modification of importing user (safety check)");
                        $modelClass::reguard();
                        return $model;
                    }
                    
                    if ($model) {
                        // Update existing record (restore if soft-deleted)
                        $model->fill($data);
                        $model->deleted_at = $data['deleted_at'] ?? null; // Restore or keep deleted
                        $model->save();
                        \Log::debug("Import: Updated existing {$entityType} with public_id {$publicId}");
                    } else {
                        // Create new record
                        $model = new $modelClass($data);
                        $model->save();
                    }
                    
                    // Re-enable mass assignment protection
                    $modelClass::reguard();
                    
                    return $model;
                });

                // Store mapping
                if ($publicId && $model->id) {
                    $idMapping->set($entityType, $publicId, $model->id);
                }

                $count++;
            } catch (\Exception $e) {
                $errorMessage = $e->getMessage();
                
                // Check if this is a critical error that should stop the import
                $criticalErrors = [
                    '42703', // Undefined column
                    '42P01', // Undefined table
                    '23505', // Duplicate key
                    '42704', // Undefined object
                ];
                
                $isCritical = false;
                foreach ($criticalErrors as $errorCode) {
                    if (strpos($errorMessage, $errorCode) !== false) {
                        $isCritical = true;
                        break;
                    }
                }
                
                // Also check for "transaction is aborted" which means a previous error occurred
                if (strpos($errorMessage, '25P02') !== false || strpos($errorMessage, 'transaction is aborted') !== false) {
                    // Transaction already aborted by previous error - re-throw to fail import
                    \Log::error("Import: Transaction aborted - failing import. Error: " . $errorMessage);
                    throw new \RuntimeException("Import fehlgeschlagen: Transaktion wurde durch einen vorherigen Fehler abgebrochen. Bitte prüfen Sie die Logs.");
                }
                
                if ($isCritical) {
                    // Re-throw critical errors to fail the import
                    \Log::error("Import: Critical error in {$entityType} - failing import. Error: " . $errorMessage);
                    throw new \RuntimeException("Import fehlgeschlagen bei {$entityType}: " . $errorMessage);
                }
                
                // Log non-critical errors but continue with other records
                \Log::warning("Could not import {$entityType} record: " . $errorMessage);
            }
        }

        fclose($handle);
        
        // Log import result
        \Log::info("Import: {$entityType} - {$count} records imported");
        
        return $count;
    }

    /**
     * Map foreign key references from public_id to internal_id.
     */
    protected function mapForeignKeys(string $entityType, array $data, ImportIdMapping $idMapping): array
    {
        // Define foreign key mappings
        $mappings = [
            'invoices' => [
                'contact_public_id' => ['contacts', 'contact_id'],
                'order_public_id' => ['orders', 'order_id'],
                'journal_entry_public_id' => ['journal_entries', 'journal_entry_id'],
            ],
            'invoice_lines' => [
                'invoice_public_id' => ['invoices', 'invoice_id'],
                'product_public_id' => ['products', 'product_id'],
                'account_public_id' => ['accounts', 'account_id'],
            ],
            'quotes' => [
                'contact_public_id' => ['contacts', 'contact_id'],
                'order_public_id' => ['orders', 'order_id'],
            ],
            'quote_lines' => [
                'quote_public_id' => ['quotes', 'quote_id'],
                'product_public_id' => ['products', 'product_id'],
            ],
            'orders' => [
                'contact_public_id' => ['contacts', 'contact_id'],
                'quote_public_id' => ['quotes', 'quote_id'],
            ],
            'order_lines' => [
                'order_public_id' => ['orders', 'order_id'],
                'product_public_id' => ['products', 'product_id'],
            ],
            'delivery_notes' => [
                'contact_public_id' => ['contacts', 'contact_id'],
                'order_public_id' => ['orders', 'order_id'],
            ],
            'delivery_note_lines' => [
                'delivery_note_public_id' => ['delivery_notes', 'delivery_note_id'],
                'order_line_public_id' => ['order_lines', 'order_line_id'],
            ],
            'belege' => [
                'contact_public_id' => ['contacts', 'contact_id'],
                'category_account_public_id' => ['accounts', 'category_account_id'],
                'payment_account_public_id' => ['accounts', 'payment_account_id'],
                'journal_entry_public_id' => ['journal_entries', 'journal_entry_id'],
            ],
            'beleg_lines' => [
                'beleg_public_id' => ['belege', 'beleg_id'],
                'product_public_id' => ['products', 'product_id'],
                'account_public_id' => ['accounts', 'account_id'],
            ],
            'products' => [
                'account_public_id' => ['accounts', 'account_id'],
                'expense_account_public_id' => ['accounts', 'expense_account_id'],
                'category_public_id' => ['product_categories', 'category_id'],
            ],
            'contacts' => [
                'customer_account_public_id' => ['accounts', 'customer_account_id'],
                'vendor_account_public_id' => ['accounts', 'vendor_account_id'],
            ],
            'bank_accounts' => [
                'account_public_id' => ['accounts', 'account_id'],
            ],
            'tax_codes' => [
                'account_public_id' => ['accounts', 'account_id'],
            ],
            'journal_entries' => [
                'user_public_id' => ['users', 'user_id'],
                'contact_public_id' => ['contacts', 'contact_id'],
                'beleg_public_id' => ['belege', 'beleg_id'],
            ],
            'journal_entry_lines' => [
                'journal_entry_public_id' => ['journal_entries', 'journal_entry_id'],
                'account_public_id' => ['accounts', 'account_id'],
            ],
            'inventory_transactions' => [
                'product_public_id' => ['products', 'product_id'],
            ],
        ];


        if (!isset($mappings[$entityType])) {
            return $data;
        }

        foreach ($mappings[$entityType] as $publicIdField => [$refEntityType, $idField]) {
            if (isset($data[$publicIdField])) {
                $refPublicId = $data[$publicIdField];
                unset($data[$publicIdField]);
                
                if ($refPublicId) {
                    $data[$idField] = $idMapping->get($refEntityType, $refPublicId);
                } else {
                    // Set to null if no reference
                    $data[$idField] = null;
                }
            }
        }
        
        // Clean up any remaining *_public_id fields that weren't mapped
        // This prevents PostgreSQL errors for non-existent columns
        foreach (array_keys($data) as $key) {
            if (str_ends_with($key, '_public_id') && $key !== 'public_id') {
                unset($data[$key]);
            }
        }

        return $data;

    }

    /**
     * Prepare data for database insert.
     */
    protected function prepareForInsert(string $entityType, array $data): array
    {
        // Remove created_at and updated_at - let timestamps be handled automatically
        // BUT keep deleted_at to preserve soft-deleted records!
        unset($data['created_at'], $data['updated_at']);
        
        // Handle deleted_at field properly
        if (array_key_exists('deleted_at', $data)) {
            if ($data['deleted_at'] === null || $data['deleted_at'] === '' || $data['deleted_at'] === 'null') {
                // Explicitly set to null for non-deleted records
                $data['deleted_at'] = null;
            } elseif (is_string($data['deleted_at']) && !empty($data['deleted_at'])) {
                // Parse date string for soft-deleted records
                $data['deleted_at'] = \Carbon\Carbon::parse($data['deleted_at']);
            }
        }

        // Handle password for users
        if ($entityType === 'users' && isset($data['password_hash'])) {
            $data['password'] = $data['password_hash'];
            unset($data['password_hash']);
        }

        // Handle roles for users
        if ($entityType === 'users') {
            unset($data['roles']); // Roles will be handled separately
        }

        // Convert money fields from decimal strings to integers (cents)
        // The export formats these as decimals, but DB stores as integers
        $moneyFields = [
            'quotes' => ['subtotal', 'tax_total', 'total'],
            'quote_lines' => ['unit_price', 'line_total'],
            'orders' => ['subtotal', 'tax_total', 'total'],
            'order_lines' => ['unit_price', 'line_total'],
            'invoices' => ['subtotal', 'tax_total', 'total', 'amount_paid'],
            'invoice_lines' => ['unit_price', 'line_total'],
            'delivery_notes' => ['subtotal', 'tax_total', 'total'],
            'delivery_note_lines' => ['unit_price', 'line_total'],
            'belege' => ['amount', 'tax_amount'],
            'journal_entry_lines' => ['amount', 'tax_amount'],
            'products' => ['purchase_price', 'selling_price'],
        ];
        
        if (isset($moneyFields[$entityType])) {
            foreach ($moneyFields[$entityType] as $field) {
                if (isset($data[$field]) && is_string($data[$field])) {
                    // Convert decimal string like "400.00" to integer
                    $data[$field] = (int) round((float) $data[$field]);
                }
            }
        }

        // Remove columns that don't exist in the target table (schema mismatch protection)
        // This prevents errors like "column X does not exist" when importing from different schema versions
        $modelClass = $this->getModelClass($entityType);
        if ($modelClass && class_exists($modelClass)) {
            try {
                $instance = new $modelClass;
                $table = $instance->getTable();
                $validColumns = \Schema::getColumnListing($table);
                
                foreach (array_keys($data) as $column) {
                    if (!in_array($column, $validColumns)) {
                        \Log::debug("Import: Removing unknown column '{$column}' from {$entityType} (not in schema)");
                        unset($data[$column]);
                    }
                }
            } catch (\Exception $e) {
                // Ignore schema check errors - continue with import
            }
        }

        return $data;
    }

    /**
     * Import files from the backup.
     */
    protected function importFiles(string $filesDir, array $fileManifest): int
    {
        $restoredCount = 0;
        $failedCount = 0;
        
        foreach ($fileManifest as $fileInfo) {
            try {
                $sourcePath = str_replace('files/', '', $fileInfo['path']);
                $sourceFullPath = "{$filesDir}/{$sourcePath}";
                
                if (!file_exists($sourceFullPath)) {
                    \Log::warning("Import: File not found in backup: {$sourcePath}");
                    $failedCount++;
                    continue;
                }
                
                if (!isset($fileInfo['original_path'])) {
                    \Log::warning("Import: Missing original_path for file: {$sourcePath}");
                    $failedCount++;
                    continue;
                }
                
                $content = file_get_contents($sourceFullPath);
                
                // Verify checksum if available
                if (isset($fileInfo['checksum'])) {
                    $expectedChecksum = str_replace('sha256:', '', $fileInfo['checksum']);
                    $actualChecksum = hash('sha256', $content);
                    if ($expectedChecksum !== $actualChecksum) {
                        \Log::error("Import: Checksum mismatch for file: {$sourcePath}");
                        $failedCount++;
                        continue;
                    }
                }
                
                // Use disk from manifest, fallback to 'public' for legacy backups
                $disk = $fileInfo['disk'] ?? 'public';
                
                // Store the file
                Storage::disk($disk)->put($fileInfo['original_path'], $content);
                $restoredCount++;
                
                \Log::info("Import: Restored file {$fileInfo['original_path']} to disk '{$disk}'");
                
            } catch (\Exception $e) {
                \Log::error("Import: Failed to restore file {$sourcePath}: " . $e->getMessage());
                $failedCount++;
            }
        }
        
        \Log::info("Import: Files restored - Success: {$restoredCount}, Failed: {$failedCount}");
        
        return $restoredCount;
    }

    /**
     * Get the model class for an entity type.
     */
    protected function getModelClass(string $entityType): ?string
    {
        $map = [
            'tenants' => \App\Models\Tenant::class,
            'users' => \App\Models\User::class,
            'accounts' => \App\Modules\Accounting\Models\Account::class,
            'tax_codes' => \App\Models\TaxCode::class,
            'product_categories' => \App\Models\ProductCategory::class,
            'products' => \App\Models\Product::class,
            'contacts' => \App\Modules\Contacts\Models\Contact::class,
            'bank_accounts' => \App\Models\BankAccount::class,
            'company_settings' => \App\Models\CompanySetting::class,
            'quotes' => \App\Models\Quote::class,
            'quote_lines' => \App\Models\QuoteLine::class,
            'orders' => \App\Models\Order::class,
            'order_lines' => \App\Models\OrderLine::class,
            'delivery_notes' => \App\Models\DeliveryNote::class,
            'delivery_note_lines' => \App\Models\DeliveryNoteLine::class,
            'invoices' => \App\Models\Invoice::class,
            'invoice_lines' => \App\Models\InvoiceLine::class,
            'belege' => \App\Models\Beleg::class,
            'beleg_lines' => \App\Models\BelegLine::class,
            'journal_entries' => \App\Modules\Accounting\Models\JournalEntry::class,
            'journal_entry_lines' => \App\Modules\Accounting\Models\JournalEntryLine::class,
            'inventory_transactions' => \App\Models\InventoryTransaction::class,
            // Note: 'documents' excluded - uses morph relationship without direct tenant_id
        ];

        return $map[$entityType] ?? null;
    }

    /**
     * Get the current schema version.
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
     * Remove temp directory.
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
}
