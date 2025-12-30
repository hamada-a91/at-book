<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->foreignId('contact_id')->constrained('contacts')->onDelete('restrict');
            $table->string('quote_number');
            $table->date('quote_date');
            $table->date('valid_until')->nullable();
            $table->enum('status', ['draft', 'sent', 'accepted', 'rejected', 'ordered'])->default('draft');
            $table->integer('subtotal')->default(0); // in cents
            $table->integer('tax_total')->default(0); // in cents
            $table->integer('total')->default(0); // in cents
            $table->text('intro_text')->nullable();
            $table->text('payment_terms')->nullable();
            $table->text('footer_note')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Tenant-scoped unique constraint
            $table->unique(['tenant_id', 'quote_number']);
        });

        Schema::create('quote_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quote_id')->constrained('quotes')->onDelete('cascade');
            $table->text('description');
            $table->decimal('quantity', 10, 2);
            $table->string('unit')->default('Stück');
            $table->integer('unit_price'); // in cents
            $table->decimal('tax_rate', 5, 2);
            $table->integer('line_total'); // in cents
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_lines');
        Schema::dropIfExists('quotes');
    }
};
