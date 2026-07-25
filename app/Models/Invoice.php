<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use BelongsToTenant, HasPublicId;

    protected $fillable = [
        'invoice_number',
        'contact_id',
        'project_id',
        'order_id',
        'invoice_date',
        'due_date',
        'status',
        'subtotal',
        'tax_total',
        'total',
        'journal_entry_id',
        'notes',
        'intro_text',
        'payment_terms',
        'footer_note',
    ];

    protected $casts = [
        'invoice_date' => 'date',
        'due_date' => 'date',
    ];

    public function contact()
    {
        return $this->belongsTo(\App\Modules\Contacts\Models\Contact::class);
    }

    public function lines()
    {
        return $this->hasMany(InvoiceLine::class);
    }

    public function journalEntry()
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\JournalEntry::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * SPEC-08 (Teil A): Default-Kostenträger-Zuordnung fürs ganze Dokument
     * (Durchreich-Logik in InvoiceBookingService::buildLines()).
     */
    public function project()
    {
        return $this->belongsTo(\App\Modules\Projects\Models\Project::class);
    }
}
