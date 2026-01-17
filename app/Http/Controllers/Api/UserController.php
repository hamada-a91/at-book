<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function index()
    {
        if (!auth()->user()->can('user.view')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $users = User::with('roles')
            ->where('tenant_id', auth()->user()->tenant_id)
            ->get();

        return response()->json($users);
    }

    public function store(Request $request)
    {
        if (!auth()->user()->can('user.create')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'role' => ['required', 'string', 'exists:roles,name'],
        ]);

        // Prevent creating Owner/Admin if not authorized (e.g. Manager shouldn't create Owner)
        // For now, let's keep it simple: Manager has user.create so they can create.
        // Maybe restrict Manager from assigning 'owner' role?
        if ($validated['role'] === 'owner' && !auth()->user()->hasRole('owner')) {
             return response()->json(['message' => 'Only owners can create other owners'], 403);
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'tenant_id' => auth()->user()->tenant_id,
        ]);

        $user->assignRole($validated['role']);

        return response()->json($user->load('roles'), 201);
    }

    public function show(User $user)
    {
        if (!auth()->user()->can('user.view')) {
             return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        if ($user->tenant_id !== auth()->user()->tenant_id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json($user->load('roles'));
    }

    public function update(Request $request, User $user)
    {
        if (!auth()->user()->can('user.edit')) {
             return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($user->tenant_id !== auth()->user()->tenant_id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => ['nullable', 'confirmed', Password::defaults()],
            'role' => ['sometimes', 'string', 'exists:roles,name'],
        ]);

        // Constraint: Manager cannot edit Owner
        if ($user->hasRole('owner') && !auth()->user()->hasRole('owner')) {
            return response()->json(['message' => 'Managers cannot edit Owners'], 403);
        }
        
        // Constraint: Manager cannot assign Owner role
        if (isset($validated['role']) && $validated['role'] === 'owner' && !auth()->user()->hasRole('owner')) {
             return response()->json(['message' => 'Only owners can assign owner role'], 403);
        }

        $user->fill([
            'name' => $validated['name'] ?? $user->name,
            'email' => $validated['email'] ?? $user->email,
        ]);

        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        if (isset($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        return response()->json($user->load('roles'));
    }

    public function destroy(User $user)
    {
        if (!auth()->user()->can('user.delete')) {
             return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($user->tenant_id !== auth()->user()->tenant_id) {
            return response()->json(['message' => 'Not found'], 404);
        }
        
        if ($user->id === auth()->id()) {
            return response()->json(['message' => 'Cannot delete yourself'], 400);
        }
        
        // Prevent deleting the last owner? 
        // Logic: if user is owner, check if other owners exist.
        if ($user->hasRole('owner')) {
             $ownerCount = User::where('tenant_id', $user->tenant_id)->role('owner')->count();
             if ($ownerCount <= 1) {
                 return response()->json(['message' => 'Cannot delete the last owner'], 400);
             }
        }

        $user->delete();

        return response()->json(['message' => 'User deleted']);
    }
}
