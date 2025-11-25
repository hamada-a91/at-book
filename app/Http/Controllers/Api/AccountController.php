<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Accounting\Models\Account;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    /**
     * List all accounts (Chart of Accounts)
     */
    public function index(): JsonResponse
    {
        $accounts = Account::orderBy('code')->get();
        return response()->json($accounts);
    }

    /**
     * Store a newly created account in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|unique:accounts,code|max:10',
            'name' => 'required|string|max:255',
            'type' => 'required|in:asset,liability,equity,revenue,expense',
            'tax_key_code' => 'nullable|string',
        ]);

        $account = Account::create($validated);

        return response()->json($account, 201);
    }
}
