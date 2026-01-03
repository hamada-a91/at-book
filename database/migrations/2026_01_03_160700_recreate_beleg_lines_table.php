<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Drop existing table and recreate with all columns
        Schema::dropIfExists('beleg_lines');
        
        Schema::create('beleg_lines', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('beleg_id');
            $table->unsignedBigInteger('product_id')->nullable();
            $table->string('description');
            $table->decimal('quantity', 10, 2)->default(1);
            $table->string('unit', 50)->default('Stueck');
            $table->integer('unit_price')->default(0);
            $table->decimal('tax_rate', 5, 2)->default(19);
            $table->integer('line_total')->default(0);
            $table->unsignedBigInteger('account_id')->nullable();
            $table->timestamps();

            $table->foreign('beleg_id')->references('id')->on('belege')->onDelete('cascade');
            $table->index('product_id');
            $table->index('account_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('beleg_lines');
    }
};
