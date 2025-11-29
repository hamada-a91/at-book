<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->text('intro_text')->nullable()->after('notes');
            $table->string('payment_terms')->default('Zahlbar sofort, rein netto')->after('intro_text');
            $table->text('footer_note')->nullable()->after('payment_terms');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['intro_text', 'payment_terms', 'footer_note']);
        });
    }
};
