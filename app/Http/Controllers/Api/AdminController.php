<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BugReport;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\AuditLog;
use Illuminate\Http\Request;

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

    public function blockUser($id)
    {
        $user = User::findOrFail($id);

        // Prevent blocking self
        if ($user->id === auth()->id()) {
            return response()->json(['message' => 'You cannot block yourself'], 403);
        }

        $user->update(['blocked_at' => now()]);

        // SPEC-06: fachlicher Event, explizit hier gefeuert (siehe
        // AuditObserver::isServiceManaged() - unterdrückt den generischen
        // 'updated'-Eintrag für genau diesen Übergang).
        AuditLog::record($user, 'blocked', ['blocked_at' => null], ['blocked_at' => $user->blocked_at?->toIso8601String()]);

        return response()->json(['message' => 'User blocked successfully', 'user' => $user]);
    }

    public function unblockUser($id)
    {
        $user = User::findOrFail($id);
        $oldBlockedAt = $user->blocked_at?->toIso8601String();
        $user->update(['blocked_at' => null]);

        AuditLog::record($user, 'unblocked', ['blocked_at' => $oldBlockedAt], ['blocked_at' => null]);

        return response()->json(['message' => 'User unblocked successfully', 'user' => $user]);
    }
}
