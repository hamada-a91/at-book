<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SPEC-08 (Teil A): Modul-Flags analog zu module_inventory_enabled.
 * module_projects_enabled schaltet Projekte frei; module_cost_centers_enabled
 * ist der separate Fortgeschrittenen-Toggle für Kostenstellen (KOST1) - siehe
 * SPEC-08 "UI-Leitprinzip: Projekt-zentriert". Beide default false: bestehende
 * Tenants sehen das Feature nicht ungefragt.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->boolean('module_projects_enabled')->default(false)->after('module_inventory_enabled');
            $table->boolean('module_cost_centers_enabled')->default(false)->after('module_projects_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn(['module_projects_enabled', 'module_cost_centers_enabled']);
        });
    }
};
