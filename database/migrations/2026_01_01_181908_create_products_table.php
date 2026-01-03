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
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->unsignedBigInteger('category_id')->nullable(); // No FK constraint due to migration order
            $table->enum('type', ['goods', 'service'])->default('goods');
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('article_number')->nullable();
            $table->string('gtin_ean')->nullable();
            $table->string('unit')->default('Stück');
            $table->integer('price_net')->default(0); // in cents
            $table->integer('price_gross')->default(0); // in cents
            $table->decimal('tax_rate', 5, 2)->default(19.00);
            $table->boolean('track_stock')->default(false);
            $table->decimal('stock_quantity', 10, 2)->default(0);
            $table->decimal('reorder_level', 10, 2)->nullable();
            $table->foreignId('account_id')->nullable()->constrained('accounts')->onDelete('set null');
            $table->foreignId('expense_account_id')->nullable()->constrained('accounts')->onDelete('set null');
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
