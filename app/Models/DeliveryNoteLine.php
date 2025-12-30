<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeliveryNoteLine extends Model
{
    protected $fillable = [
        'delivery_note_id',
        'order_line_id',
        'description',
        'quantity',
        'unit',
    ];

    public function deliveryNote()
    {
        return $this->belongsTo(DeliveryNote::class);
    }

    public function orderLine()
    {
        return $this->belongsTo(OrderLine::class);
    }
}
