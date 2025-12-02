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
        // 1. Add new columns
        Schema::table('contacts', function (Blueprint $table) {
            $table->foreignId('customer_account_id')->nullable()->after('contact_person')->constrained('accounts')->onDelete('restrict');
            $table->foreignId('vendor_account_id')->nullable()->after('customer_account_id')->constrained('accounts')->onDelete('restrict');
        });

        // 2. Migrate existing data
        $contacts = DB::table('contacts')->get();
        foreach ($contacts as $contact) {
            if ($contact->account_id) {
                if ($contact->type === 'customer') {
                    DB::table('contacts')
                        ->where('id', $contact->id)
                        ->update(['customer_account_id' => $contact->account_id]);
                } elseif ($contact->type === 'vendor') {
                    DB::table('contacts')
                        ->where('id', $contact->id)
                        ->update(['vendor_account_id' => $contact->account_id]);
                }
            }
        }

        // 3. Drop old column and modify type enum
        // Note: Modifying enum in some DBs is tricky, so we might need raw SQL or just accept it as string for now if using SQLite/Postgres without extra packages.
        // Assuming MySQL/MariaDB or standard Laravel support.
        
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropForeign(['account_id']);
            $table->dropColumn('account_id');
        });

        // Modifying enum is platform specific. 
        // For safety and compatibility, we will change the column to string first, then update values, then (optionally) back to enum or just leave as string with validation.
        // Laravel's native enum modification is limited.
        
        Schema::table('contacts', function (Blueprint $table) {
            $table->string('type')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->foreignId('account_id')->nullable()->after('contact_person')->constrained('accounts')->onDelete('restrict');
        });

        $contacts = DB::table('contacts')->get();
        foreach ($contacts as $contact) {
            $accountId = $contact->customer_account_id ?? $contact->vendor_account_id;
            if ($accountId) {
                DB::table('contacts')
                    ->where('id', $contact->id)
                    ->update(['account_id' => $accountId]);
            }
        }

        Schema::table('contacts', function (Blueprint $table) {
            $table->dropForeign(['customer_account_id']);
            $table->dropColumn('customer_account_id');
            $table->dropForeign(['vendor_account_id']);
            $table->dropColumn('vendor_account_id');
            // Revert type to enum with original values if possible, or just string
            // $table->enum('type', ['customer', 'vendor'])->change(); 
        });
    }
};
