<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\SoftDeletes;

class Order extends Model
{
    use BelongsToTenant, SoftDeletes, HasPublicId;
    
    protected $fillable = [
        'contact_id',
        'quote_id',
        'order_number',
        'order_date',
        'delivery_date',
        'status',
        'subtotal',
        'tax_total',
        'total',
        'intro_text',
        'payment_terms',
        'footer_note',
        'notes',
    ];

    protected $casts = [
        'order_date' => 'date',
        'delivery_date' => 'date',
    ];

    public function contact()
    {
        return $this->belongsTo(\App\Modules\Contacts\Models\Contact::class);
    }

    public function quote()
    {
        return $this->belongsTo(Quote::class);
    }

    public function lines()
    {
        return $this->hasMany(OrderLine::class);
    }

    public function deliveryNotes()
    {
        return $this->hasMany(DeliveryNote::class);
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }
}
