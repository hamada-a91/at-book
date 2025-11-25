<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->morphs('documentable'); // Links to JournalEntry, etc.
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type');
            $table->integer('size_bytes');
            $table->string('hash_sha256')->index()->comment('GoBD: Ensure document integrity');
            $table->timestamp('uploaded_at');
            $table->foreignId('uploaded_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
