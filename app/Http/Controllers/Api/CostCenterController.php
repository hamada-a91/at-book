<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\HasTenantScope;
use App\Http\Controllers\Controller;
use App\Modules\Accounting\Models\JournalEntryLine;
use App\Modules\Projects\Models\CostCenter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * SPEC-08 (Teil A): Kostenstelle (KOST1) - CRUD. Schreib-Routen (store/
 * update/destroy) sind in routes/api.php per role-Middleware auf
 * owner|manager|buchhalter beschränkt; index/show bleiben für alle
 * angemeldeten Rollen offen (u.a. cachier braucht die Liste zum Auswählen
 * beim Erfassen, falls das Fortgeschrittenen-Modul aktiv ist).
 */
class CostCenterController extends Controller
{
    use HasTenantScope;

    public function index(Request $request)
    {
        $tenant = $this->getTenantOrFail();
        $query = CostCenter::where('tenant_id', $tenant->id);

        if ($request->boolean('active_only')) {
            $query->where('active', true);
        }

        return response()->json($query->orderBy('code')->get());
    }

    public function store(Request $request)
    {
        $tenant = $this->getTenantOrFail();

        $validated = $request->validate([
            'code' => 'required|string|max:50',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'active' => 'nullable|boolean',
        ]);

        $costCenter = CostCenter::create([
            'tenant_id' => $tenant->id,
            'code' => $validated['code'],
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'active' => $validated['active'] ?? true,
        ]);

        return response()->json($costCenter, 201);
    }

    public function show(CostCenter $costCenter)
    {
        $this->assertOwnedByTenant($costCenter);

        return response()->json($costCenter);
    }

    public function update(Request $request, CostCenter $costCenter)
    {
        $this->assertOwnedByTenant($costCenter);

        $validated = $request->validate([
            'code' => 'required|string|max:50',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'active' => 'nullable|boolean',
        ]);

        $costCenter->update($validated);

        return response()->json($costCenter);
    }

    /**
     * Löschen nur, solange keine Buchungen (Journal- oder Dokumentzeilen) die
     * Kostenstelle referenzieren - sonst 422, Hinweis auf Deaktivieren
     * (active=false) statt Löschen.
     */
    public function destroy(CostCenter $costCenter)
    {
        $this->assertOwnedByTenant($costCenter);

        if ($this->isInUse($costCenter)) {
            return response()->json([
                'error' => 'Diese Kostenstelle wird bereits in Buchungen verwendet und kann nicht gelöscht werden. Bitte deaktivieren Sie sie stattdessen.',
            ], 422);
        }

        $costCenter->delete();

        return response()->json(['message' => 'Kostenstelle gelöscht']);
    }

    private function isInUse(CostCenter $costCenter): bool
    {
        if (JournalEntryLine::where('cost_center_id', $costCenter->id)->exists()) {
            return true;
        }

        foreach (['invoice_lines', 'beleg_lines', 'quote_lines', 'order_lines'] as $table) {
            if (DB::table($table)->where('cost_center_id', $costCenter->id)->exists()) {
                return true;
            }
        }

        return false;
    }
}
