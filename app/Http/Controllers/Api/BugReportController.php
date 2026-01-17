<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\BugReport;

class BugReportController extends Controller
{
    public function index()
    {
        $query = BugReport::with('user');
        
        // If not super admin (or similar), restrict to tenant
        $user = auth()->user();
        if ($user->tenant_id) {
             $query->where('tenant_id', $user->tenant_id);
        }

        return response()->json($query->latest()->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'error_details' => 'nullable|string',
            'priority' => 'required|in:low,medium,high,critical',
        ]);

        $report = BugReport::create([
            'tenant_id' => auth()->user()->tenant_id,
            'user_id' => auth()->id(),
            'title' => $validated['title'],
            'description' => $validated['description'],
            'error_details' => $validated['error_details'],
            'priority' => $validated['priority'],
            'status' => 'open',
        ]);

        return response()->json($report, 201);
    }
}
