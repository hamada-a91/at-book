php<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\CompanySetting;
use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;

class InvoiceController extends Controller
{
    // ... existing methods ...
    
    public function downloadPDF(Invoice $invoice)
    {
        $invoice->load(['contact', 'lines']);
        $settings = CompanySetting::first();
        
        // Prepare data
        $data = [
            'invoice' => $invoice,
            'settings' => $settings,
        ];
        
        // Generate PDF
        $pdf = Pdf::loadView('invoices.pdf', $data);
        
        // Download
        return $pdf->download("Rechnung-{$invoice->invoice_number}.pdf");
    }
}
