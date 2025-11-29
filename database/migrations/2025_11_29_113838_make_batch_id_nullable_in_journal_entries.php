<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Use raw SQL for PostgreSQL
        DB::statement('ALTER TABLE journal_entries ALTER COLUMN batch_id DROP NOT NULL');
        DB::statement('ALTER TABLE journal_entries ALTER COLUMN user_id DROP NOT NULL');
        
        // Add contact_id if it doesn't exist
        if (!DB::getSchemaBuilder()->hasColumn('journal_entries', 'contact_id')) {
            DB::statement('ALTER TABLE journal_entries ADD COLUMN contact_id BIGINT NULL');
        }
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE journal_entries DROP COLUMN IF EXISTS contact_id');
        DB::statement('ALTER TABLE journal_entries ALTER COLUMN batch_id SET NOT NULL');
        DB::statement('ALTER TABLE journal_entries ALTER COLUMN user_id SET NOT NULL');
    }
};
