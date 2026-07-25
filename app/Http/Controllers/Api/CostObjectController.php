<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\HasTenantScope;
use App\Http\Controllers\Controller;
use App\Modules\Accounting\Models\JournalEntryLine;
use App\Modules\Projects\Models\CostObject;
use App\Modules\Projects\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * SPEC-08 (Teil A): Kostenträger (KOST2) - CRUD. Kostenträger, die als
 * dediziertes Kostenträger-Objekt eines Projekts angelegt wurden (siehe
 * ProjectController::store()), sollten normalerweise über das Projekt selbst
 * verwaltet werden - direktes Bearbeiten/Löschen hier bleibt dennoch möglich
 * (z.B. für eigenständige, nicht an ein Projekt gebundene Kostenträger).
 */
class CostObjectController extends Controller
{
    use HasTenantScope;

    public function index(Request $request)
    {
        $tenant = $this->getTenantOrFail();
        $query = CostObject::where('tenant_id', $tenant->id);

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

        $costObject = CostObject::create([
            'tenant_id' => $tenant->id,
            'code' => $validated['code'],
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'active' => $validated['active'] ?? true,
        ]);

        return response()->json($costObject, 201);
    }

    public function show(CostObject $costObject)
    {
        return response()->json($costObject);
    }

    public function update(Request $request, CostObject $costObject)
    {
        $validated = $request->validate([
            'code' => 'required|string|max:50',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'active' => 'nullable|boolean',
        ]);

        $costObject->update($validated);

        return response()->json($costObject);
    }

    /**
     * Löschen nur, solange keine Buchungen (Journal- oder Dokumentzeilen) den
     * Kostenträger referenzieren UND er nicht das dedizierte Kostenträger-Objekt
     * eines Projekts ist - sonst 422, Hinweis auf Deaktivieren statt Löschen.
     */
    public function destroy(CostObject $costObject)
    {
        if (Project::where('cost_object_id', $costObject->id)->exists()) {
            return response()->json([
                'error' => 'Dieser Kostenträger ist einem Projekt zugeordnet und kann nicht gelöscht werden. Bitte das Projekt archivieren/deaktivieren.',
            ], 422);
        }

        if ($this->isInUse($costObject)) {
            return response()->json([
                'error' => 'Dieser Kostenträger wird bereits in Buchungen verwendet und kann nicht gelöscht werden. Bitte deaktivieren Sie ihn stattdessen.',
            ], 422);
        }

        $costObject->delete();

        return response()->json(['message' => 'Kostenträger gelöscht']);
    }

    private function isInUse(CostObject $costObject): bool
    {
        if (JournalEntryLine::where('cost_object_id', $costObject->id)->exists()) {
            return true;
        }

        foreach (['invoice_lines', 'beleg_lines', 'quote_lines', 'order_lines'] as $table) {
            if (DB::table($table)->where('cost_object_id', $costObject->id)->exists()) {
                return true;
            }
        }

        return false;
    }
}
