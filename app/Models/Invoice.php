<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;

class Invoice extends Model
{
    use BelongsToTenant, HasPublicId;
    
    protected $fillable = [
        'invoice_number',
        'contact_id',
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
}
