<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('belege', function (Blueprint $table) {
            if (! Schema::hasColumn('belege', 'ocr_status')) {
                $table->string('ocr_status', 20)->default('none')->after('status')->index();
            }

            if (! Schema::hasColumn('belege', 'ocr_data')) {
                $table->jsonb('ocr_data')->nullable()->after('ocr_status');
            }

            if (! Schema::hasColumn('belege', 'ocr_provider')) {
                $table->string('ocr_provider')->nullable()->after('ocr_data');
            }
        });
    }

    public function down(): void
    {
        Schema::table('belege', function (Blueprint $table) {
            if (Schema::hasColumn('belege', 'ocr_provider')) {
                $table->dropColumn('ocr_provider');
            }

            if (Schema::hasColumn('belege', 'ocr_data')) {
                $table->dropColumn('ocr_data');
            }

            if (Schema::hasColumn('belege', 'ocr_status')) {
                $table->dropColumn('ocr_status');
            }
        });
    }
};
