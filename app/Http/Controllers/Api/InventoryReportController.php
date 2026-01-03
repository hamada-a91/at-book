<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Concerns\HasTenantScope;
use App\Models\InventoryTransaction;
use Illuminate\Http\Request;

class InventoryReportController extends Controller
{
    use HasTenantScope;

    public function index(Request $request)
    {
        $tenant = $this->getTenantOrFail();
        
        $query = InventoryTransaction::with(['product'])
            ->whereHas('product', function($q) use ($tenant) {
                $q->where('tenant_id', $tenant->id);
            });

        // Filter by product
        if ($request->has('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        // Filter by date range
        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        
        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Filter by type
        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        return response()->json(
            $query->latest()->paginate(50)
        );
    }
}
