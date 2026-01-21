<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\SoftDeletes;

class Quote extends Model
{
    use BelongsToTenant, SoftDeletes, HasPublicId;
    
    protected $fillable = [
        'contact_id',
        'quote_number',
        'quote_date',
        'valid_until',
        'status',
        'subtotal',
        'tax_total',
        'total',
        'intro_text',
        'payment_terms',
        'footer_note',
        'notes',
        'order_id',
    ];

    protected $casts = [
        'quote_date' => 'date',
        'valid_until' => 'date',
    ];

    public function contact()
    {
        return $this->belongsTo(\App\Modules\Contacts\Models\Contact::class);
    }

    public function lines()
    {
        return $this->hasMany(QuoteLine::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
