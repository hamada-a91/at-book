<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\HasPublicId;

class OrderLine extends Model
{
    use HasPublicId;
    protected $fillable = [
        'order_id',
        'product_id',
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

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function deliveryNoteLines()
    {
        return $this->hasMany(DeliveryNoteLine::class);
    }
}

