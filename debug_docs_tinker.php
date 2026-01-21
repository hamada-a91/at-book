<?php
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Documents\Models\Document;
use App\Models\Tenant;

// Mock tenant
$tenantId = 2; // From error message

echo "Testing Document query...\n";

try {
    $journalEntryIds = JournalEntry::where('tenant_id', $tenantId)->pluck('id');
    echo "JournalEntry IDs count: " . $journalEntryIds->count() . "\n";

    $documents = Document::where('documentable_type', 'App\\Modules\\Accounting\\Models\\JournalEntry')
        ->whereIn('documentable_id', $journalEntryIds)
        ->toSql();
        
    echo "Query SQL: " . $documents . "\n";

    // Try executing
    Document::where('documentable_type', 'App\\Modules\\Accounting\\Models\\JournalEntry')
        ->whereIn('documentable_id', $journalEntryIds)
        ->cursor()->each(function($doc) {
            echo "Doc: " . $doc->id . "\n";
        });

} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

echo "\n-------------------\n";
echo "Testing if Document has global scope...\n";
$scopes = (new Document)->getGlobalScopes();
print_r(array_keys($scopes));
