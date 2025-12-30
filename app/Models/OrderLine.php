<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderLine extends Model
{
    protected $fillable = [
        'order_id',
        'description',
        'quantity',
        'delivered_quantity',
        'invoiced_quantity',
        'unit',
        'unit_price',
        'tax_rate',
        'line_total',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function deliveryNoteLines()
    {
        return $this->hasMany(DeliveryNoteLine::class);
    }
}
