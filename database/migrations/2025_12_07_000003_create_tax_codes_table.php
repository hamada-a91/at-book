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
        Schema::create('tax_codes', function (Blueprint $table) {
            $table->id();
            
            // Steuerschlüssel (eindeutig)
            $table->string('code', 10)->unique()->comment('z.B. UST19, UST7, VST19, VST7, RC, IG, EX');
            
            // Bezeichnung
            $table->string('name')->comment('z.B. Umsatzsteuer 19%, Vorsteuer 19%');
            
            // Typ
            $table->enum('type', [
                'output_tax',      // Umsatzsteuer
                'input_tax',       // Vorsteuer
                'reverse_charge',  // Reverse Charge
                'intra_eu',        // Innergemeinschaftlich
                'export'           // Export (steuerfrei)
            ])->comment('Art des Steuerschlüssels');
            
            // Steuersatz
            $table->decimal('rate', 5, 2)->comment('Steuersatz: 0, 7, 19');
            
            // Verknüpfung zum Steuerkonto (z.B. 1776 für USt 19%)
            $table->foreignId('account_id')->nullable()->constrained('accounts')->onDelete('set null')
                ->comment('Verknüpftes Steuerkonto');
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tax_codes');
    }
};
