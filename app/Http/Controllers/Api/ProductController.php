<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\HasTenantScope;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    use HasTenantScope;

    public function index(Request $request)
    {
        $tenant = $this->getTenantOrFail();
        
        $query = Product::where('tenant_id', $tenant->id)
            ->with(['category', 'inventoryTransactions' => function($query) {
                $query->latest()->limit(50);
            }]);

        // Search
        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                  ->orWhere('article_number', 'LIKE', "%{$search}%")
                  ->orWhere('gtin_ean', 'LIKE', "%{$search}%");
            });
        }

        // Filter by category
        if ($request->has('category_id') && $request->input('category_id') !== '') {
            $query->where('category_id', $request->input('category_id'));
        }

        // Filter by type
        if ($request->has('type')) {
            $query->where('type', $request->input('type'));
        }

        $products = $query->orderBy('name')->get();

        return response()->json($products);
    }

    public function store(Request $request)
    {
        $tenant = $this->getTenantOrFail();
        
        $validated = $request->validate([
            'type' => 'required|in:goods,service',
            'name' => 'required|string|max:255',
            'category_id' => 'nullable|exists:product_categories,id',
            'description' => 'nullable|string',
            'article_number' => 'nullable|string|max:255',
            'gtin_ean' => 'nullable|string|max:255',
            'unit' => 'required|string|max:50',
            'price_net' => 'required|integer|min:0',
            'price_gross' => 'required|integer|min:0',
            'tax_rate' => 'required|numeric|min:0|max:100',
            'track_stock' => 'boolean',
            'stock_quantity' => 'nullable|numeric',
            'reorder_level' => 'nullable|numeric',
            'account_id' => 'nullable|exists:accounts,id',
            'expense_account_id' => 'nullable|exists:accounts,id',
            'notes' => 'nullable|string',
        ]);

        $validated['tenant_id'] = $tenant->id;
        
        // Services can't track stock
        if ($validated['type'] === 'service') {
            $validated['track_stock'] = false;
            $validated['stock_quantity'] = 0;
        }

        $product = Product::create($validated);

        return response()->json($product->load('category'), 201);
    }

    public function show($id)
    {
        $tenant = $this->getTenantOrFail();
        
        $product = Product::where('tenant_id', $tenant->id)
            ->with(['category', 'inventoryTransactions' => function($query) {
                $query->latest()->limit(50);
            }])
            ->findOrFail($id);

        return response()->json($product);
    }

    public function update(Request $request, $id)
    {
        $tenant = $this->getTenantOrFail();
        
        $product = Product::where('tenant_id', $tenant->id)->findOrFail($id);

        $validated = $request->validate([
            'type' => 'required|in:goods,service',
            'name' => 'required|string|max:255',
            'category_id' => 'nullable|exists:product_categories,id',
            'description' => 'nullable|string',
            'article_number' => 'nullable|string|max:255',
            'gtin_ean' => 'nullable|string|max:255',
            'unit' => 'required|string|max:50',
            'price_net' => 'required|integer|min:0',
            'price_gross' => 'required|integer|min:0',
            'tax_rate' => 'required|numeric|min:0|max:100',
            'track_stock' => 'boolean',
            'reorder_level' => 'nullable|numeric',
            'notes' => 'nullable|string',
        ]);

        // Services can't track stock
        if ($validated['type'] === 'service') {
            $validated['track_stock'] = false;
        }

        // Don't allow direct stock_quantity updates - use inventory transactions instead
        unset($validated['stock_quantity']);

        $product->update($validated);

        return response()->json($product->load('category'));
    }

    public function destroy($id)
    {
        $tenant = $this->getTenantOrFail();
        
        $product = Product::where('tenant_id', $tenant->id)->findOrFail($id);

        // Check if product is used in any line items
        // This would need to check invoice_lines and beleg_lines tables
        // For now, we'll allow deletion
        
        $product->delete();

        return response()->json(['message' => 'Product deleted successfully']);
    }
}
