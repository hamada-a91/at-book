<?php

namespace App\Models;

use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;

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
        'cost_center_id',
        'cost_object_id',
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

    public function costCenter()
    {
        return $this->belongsTo(\App\Modules\Projects\Models\CostCenter::class);
    }

    public function costObject()
    {
        return $this->belongsTo(\App\Modules\Projects\Models\CostObject::class);
    }
}
