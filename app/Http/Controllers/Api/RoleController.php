<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function index()
    {
        // Return roles with permissions.
        // Filter out 'admin' as it is for system management.
        // Strictly use 'api' guard roles to avoid duplicates and mismatch.
        $roles = Role::where('guard_name', 'api')
            ->where('name', '!=', 'admin')
            ->with('permissions')
            ->get()
            ->map(function ($role) {
                return [
                    'name' => $role->name,
                    'permissions' => $role->permissions->pluck('name'),
                ];
            });
            
        return response()->json($roles);
    }
}
