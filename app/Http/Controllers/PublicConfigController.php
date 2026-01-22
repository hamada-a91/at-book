<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class PublicConfigController extends Controller
{
    /**
     * Get public configuration
     */
    public function index()
    {
        return response()->json([
            'serial_number_enabled' => (bool) env('ENABLE_SERIAL_NUMBER_ACTIVATION', false),
        ]);
    }
}
