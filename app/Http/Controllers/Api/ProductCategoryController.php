<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\HasTenantScope;
use App\Models\ProductCategory;
use Illuminate\Http\Request;

class ProductCategoryController extends Controller
{
    use HasTenantScope;

    public function index(Request $request)
    {
        $tenant = $this->getTenantOrFail();
        $categories = ProductCategory::where('tenant_id', $tenant->id)
            ->orderBy('name')
            ->get();

        return response()->json($categories);
    }

    public function store(Request $request)
    {
        $tenant = $this->getTenantOrFail();
        
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7', // hex color
        ]);

        $validated['tenant_id'] = $tenant->id;
        $category = ProductCategory::create($validated);

        return response()->json($category, 201);
    }

    public function update(Request $request, $id)
    {
        $tenant = $this->getTenantOrFail();
        
        $category = ProductCategory::where('tenant_id', $tenant->id)
            ->findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'color' => 'nullable|string|max:7',
        ]);

        $category->update($validated);

        return response()->json($category);
    }

    public function destroy($id)
    {
        $tenant = $this->getTenantOrFail();
        
        $category = ProductCategory::where('tenant_id', $tenant->id)
            ->findOrFail($id);

        // Check if category has products
        if ($category->products()->count() > 0) {
            return response()->json([
                'error' => 'Diese Kategorie kann nicht gelöscht werden, da sie noch Produkte enthält.'
            ], 422);
        }

        $category->delete();

        return response()->json(['message' => 'Kategorie gelöscht']);
    }
}
