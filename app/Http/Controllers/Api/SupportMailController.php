<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\SupportMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SupportMailController extends Controller
{
    public function send(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'message' => 'required|string|min:10',
        ]);

        $user = auth()->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $tenant = $user->tenant;
        $tenantName = $tenant ? $tenant->name : null;
        $tenantSlug = $tenant ? $tenant->slug : null;

        $adminEmail = config('atbook.admin_email', 'admin@at-book.local');

        try {
            Mail::to($adminEmail)->send(new SupportMail(
                $user->name,
                $user->email,
                $tenantName,
                $tenantSlug,
                $validated['subject'],
                $validated['message']
            ));

            return response()->json([
                'success' => true,
                'message' => 'Support-E-Mail wurde erfolgreich gesendet.',
            ]);
        } catch (\Exception $e) {
            Log::error('Support mail sending failed: '.$e->getMessage(), [
                'exception' => $e,
                'user_id' => $user->id,
                'tenant_id' => $user->tenant_id,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Fehler beim Senden der Support-E-Mail. Bitte kontaktieren Sie den Administrator direkt.',
            ], 500);
        }
    }
}
