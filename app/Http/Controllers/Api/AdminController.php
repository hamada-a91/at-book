<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Tenant;
use App\Models\User;
use App\Models\BugReport;

class AdminController extends Controller
{
    public function stats()
    {
        return response()->json([
            'tenants_count' => Tenant::count(),
            'users_count' => User::count(),
            'bugs_count' => BugReport::where('status', 'open')->count(),
        ]);
    }

    public function tenants()
    {
        $tenants = Tenant::withCount('users')->latest()->get();
        return response()->json($tenants);
    }

    public function users()
    {
        $users = User::with(['roles', 'tenant'])->latest()->paginate(20);
        return response()->json($users);
    }
    
    public function bugReports()
    {
        $reports = BugReport::with(['user', 'tenant'])->latest()->get();
        return response()->json($reports);
    }

    public function updateBugReport(Request $request, $id)
    {
        $report = BugReport::findOrFail($id);
        
        $validated = $request->validate([
            'status' => 'required|in:open,in_progress,resolved,closed',
            'priority' => 'nullable|in:low,medium,high,critical',
        ]);

        $report->update($validated);
        
        return response()->json($report);
    }
}
