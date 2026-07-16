<?php

namespace App\Http\Controllers;

class PublicConfigController extends Controller
{
    /**
     * Get public configuration
     */
    public function index()
    {
        return response()->json([
            'serial_number_enabled' => (bool) config('atbook.serial_number_activation'),
        ]);
    }
}
