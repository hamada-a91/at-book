<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Drop the check constraint that restricts the 'type' column values
        // This is necessary because the previous migration changed the column to string
        // but might not have removed the constraint in PostgreSQL.
        try {
            DB::statement('ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_type_check');
        } catch (\Exception $e) {
            // Ignore if it fails, maybe it doesn't exist or different DB
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // We don't need to recreate it strictly, but if we wanted to:
        // DB::statement("ALTER TABLE contacts ADD CONSTRAINT contacts_type_check CHECK (type::text = ANY (ARRAY['customer'::character varying, 'vendor'::character varying]::text[]))");
    }
};
