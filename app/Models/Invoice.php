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
        'amount_paid',
        'journal_entry_id',
        'notes',
        'intro_text',
        'payment_terms',
        'footer_note',
    ];

    protected $casts = [
        'invoice_date' => 'date',
        'due_date' => 'date',
        'amount_paid' => 'integer',
    ];

    protected $appends = [
        'open_amount',
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

    public function payments()
    {
        return $this->hasMany(Payment::class, 'payable_id')
            ->where('payable_type', 'invoice');
    }

    public function getOpenAmountAttribute(): int
    {
        return max(0, (int) $this->total - (int) $this->amount_paid);
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
