<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique()->comment('e.g., 8400');
            $table->string('name')->comment('e.g., Erlöse 19% USt');
            $table->string('type')->comment('asset, liability, equity, revenue, expense');
            $table->string('tax_key_code')->nullable()->comment('Default tax key, e.g., UST_19');
            $table->boolean('is_system')->default(false)->comment('If true, cannot be deleted');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounts');
    }
};
