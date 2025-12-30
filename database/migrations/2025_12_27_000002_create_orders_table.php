<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->foreignId('contact_id')->constrained('contacts')->onDelete('restrict');
            $table->foreignId('quote_id')->nullable()->constrained('quotes')->onDelete('set null');
            $table->string('order_number');
            $table->date('order_date');
            $table->date('delivery_date')->nullable();
            $table->enum('status', ['open', 'partial_delivered', 'delivered', 'partial_invoiced', 'invoiced', 'completed'])->default('open');
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
            $table->unique(['tenant_id', 'order_number']);
        });

        Schema::create('order_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->onDelete('cascade');
            $table->text('description');
            $table->decimal('quantity', 10, 2); // ordered quantity
            $table->decimal('delivered_quantity', 10, 2)->default(0);
            $table->decimal('invoiced_quantity', 10, 2)->default(0);
            $table->string('unit')->default('Stück');
            $table->integer('unit_price'); // in cents
            $table->decimal('tax_rate', 5, 2);
            $table->integer('line_total'); // in cents
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_lines');
        Schema::dropIfExists('orders');
    }
};
