<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\HasPublicId;

class DeliveryNoteLine extends Model
{
    use HasPublicId;
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
