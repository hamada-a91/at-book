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
        Schema::table('company_settings', function (Blueprint $table) {
            // Geschäftsmodelle als JSON-Array (flexibel erweiterbar)
            $table->json('business_models')->nullable()->after('tax_type')
                ->comment('Array of business models: dienstleistungen, handel, produktion, online, offline, gemischt, allgemein');
            
            // Rechtsform
            $table->enum('legal_form', [
                'einzelunternehmen', 
                'gbr', 
                'ohg', 
                'kg', 
                'gmbh', 
                'ug', 
                'ag'
            ])->nullable()->after('business_models');
            
            // Kontenplan-Status mit Timestamps
            $table->timestamp('account_plan_initialized_at')->nullable()->after('legal_form')
                ->comment('Erstmalige Kontenplan-Generierung');
            $table->timestamp('account_plan_last_updated_at')->nullable()->after('account_plan_initialized_at')
                ->comment('Letzte Erweiterung des Kontenplans');
            
            // Onboarding-Status
            $table->boolean('onboarding_completed')->default(false)->after('account_plan_last_updated_at')
                ->comment('Onboarding-Prozess abgeschlossen');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn([
                'business_models',
                'legal_form',
                'account_plan_initialized_at',
                'account_plan_last_updated_at',
                'onboarding_completed'
            ]);
        });
    }
};
