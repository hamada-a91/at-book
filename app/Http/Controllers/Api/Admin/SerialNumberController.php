<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SerialNumber;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SerialNumberController extends Controller
{
    public function index()
    {
        $serials = SerialNumber::with('usedBy:id,name,email')
            ->orderBy('created_at', 'desc')
            ->get();
            
        return response()->json($serials);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'count' => 'integer|min:1|max:50',
            'prefix' => 'nullable|string|max:10',
        ]);

        $count = $validated['count'] ?? 1;
        $prefix = $validated['prefix'] ?? '';
        $created = [];

        for ($i = 0; $i < $count; $i++) {
            $serial = SerialNumber::create([
                'serial_number' => $prefix . strtoupper(Str::random(12)),
            ]);
            $created[] = $serial;
        }

        return response()->json(['message' => "$count Serial numbers generated", 'data' => $created], 201);
    }

    /**
     * Delete a serial number (only if not used, or allow deleting used ones?)
     * Assuming we can delete whatever.
     */
    public function destroy($id)
    {
        $serial = SerialNumber::findOrFail($id);
        $serial->delete();
        return response()->json(['message' => 'Serial number deleted']);
    }
}
