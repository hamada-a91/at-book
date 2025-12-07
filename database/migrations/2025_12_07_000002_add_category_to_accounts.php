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
        Schema::table('accounts', function (Blueprint $table) {
            // SKR03-Kategorisierung
            $table->string('category')->nullable()->after('type')
                ->comment('SKR03 Kategorie: Anlagevermögen, Umlaufvermögen, Erlöse, etc.');
            
            $table->integer('skr03_class')->nullable()->after('category')
                ->comment('SKR03 Kontenklasse 0-9');
            
            // GuV/Bilanz-Zuordnung (KRITISCH für Reporting!)
            $table->enum('account_purpose', ['balance_sheet', 'income_statement'])->nullable()->after('skr03_class')
                ->comment('Zuordnung: balance_sheet (Bilanz) oder income_statement (GuV)');
            
            // Steuerschlüssel für bundesweite Steuerfähigkeit
            $table->string('default_tax_code', 10)->nullable()->after('account_purpose')
                ->comment('Standard-Steuerschlüssel: UST19, UST7, VST19, VST7, RC, IG, EX');
            
            $table->decimal('default_tax_rate', 5, 2)->nullable()->after('default_tax_code')
                ->comment('Standard-Steuersatz: 0, 7, 19');
            
            // Tax Automation Type (Frontend-Steuerung)
            $table->enum('tax_automation_type', ['fixed', 'default', 'none'])->default('none')->after('default_tax_rate')
                ->comment('fixed: nicht änderbar, default: vorausgewählt änderbar, none: kein Standard');
            
            // Generator-Flag für Update-Logik
            $table->boolean('is_generated')->default(false)->after('is_system')
                ->comment('Von Generator erstellt (für Erweiterungs-Logik)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn([
                'category',
                'skr03_class',
                'account_purpose',
                'default_tax_code',
                'default_tax_rate',
                'tax_automation_type',
                'is_generated'
            ]);
        });
    }
};
