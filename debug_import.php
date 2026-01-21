<?php

echo "=== IMPORT DEBUG ===\n\n";

// Find the latest completed export
$exportJob = \App\Models\BackupJob::where('type', 'export')
    ->where('status', 'completed')
    ->orderBy('created_at', 'desc')
    ->first();

if (!$exportJob) {
    echo "No completed export found!\n";
    exit;
}

echo "Using backup: {$exportJob->file_path}\n";

// Get tenant
$tenant = \App\Models\Tenant::find(2);
echo "Target tenant: {$tenant->name} (ID: {$tenant->id})\n\n";

// Extract ZIP to temp
$zipPath = storage_path('app/private/' . $exportJob->file_path);
$extractDir = sys_get_temp_dir() . '/test-import-' . time();
mkdir($extractDir, 0755, true);

$zip = new ZipArchive();
if ($zip->open($zipPath) !== true) {
    echo "Failed to open ZIP!\n";
    exit;
}
$zip->extractTo($extractDir);
$zip->close();

echo "Extracted to: {$extractDir}\n\n";

// Test importing each entity type
$entityOrder = [
    'tenants', 'users', 'accounts', 'tax_codes', 'product_categories',
    'products', 'contacts', 'bank_accounts', 'company_settings',
    'quotes', 'quote_lines', 'orders', 'order_lines',
    'delivery_notes', 'delivery_note_lines', 'invoices', 'invoice_lines',
    'belege', 'beleg_lines', 'journal_entries', 'journal_entry_lines',
    'inventory_transactions',
];

$importService = app(\App\Services\Backup\BackupImportService::class);

// Use reflection to access protected methods
$reflection = new ReflectionClass($importService);
$getModelClassMethod = $reflection->getMethod('getModelClass');
$getModelClassMethod->setAccessible(true);

echo "=== Testing NDJSON Reading ===\n";

foreach ($entityOrder as $entityType) {
    $ndjsonPath = "{$extractDir}/data/{$entityType}.ndjson";
    
    if (!file_exists($ndjsonPath)) {
        echo "-- {$entityType}: No file\n";
        continue;
    }
    
    // Read first line
    $handle = fopen($ndjsonPath, 'r');
    $firstLine = fgets($handle);
    fclose($handle);
    
    $lineCount = count(file($ndjsonPath));
    
    if ($firstLine) {
        $data = json_decode($firstLine, true);
        $hasPublicId = isset($data['public_id']);
        echo "OK {$entityType}: {$lineCount} lines, has public_id: " . ($hasPublicId ? 'YES' : 'NO') . "\n";
        
        // Try to get model class
        $modelClass = $getModelClassMethod->invoke($importService, $entityType);
        if ($modelClass) {
            echo "   Model: {$modelClass}\n";
        } else {
            echo "   Model: NOT FOUND!\n";
        }
    } else {
        echo "ERR {$entityType}: Empty file\n";
    }
}

// Clean up
echo "\n=== Cleaning up ===\n";
exec("rm -rf " . escapeshellarg($extractDir));
echo "Done!\n";
