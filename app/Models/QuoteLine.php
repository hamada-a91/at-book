<?php

namespace App\Models;

use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;

class QuoteLine extends Model
{
    use HasPublicId;

    protected $fillable = [
        'quote_id',
        'product_id',
        'description',
        'quantity',
        'unit',
        'unit_price',
        'tax_rate',
        'line_total',
        'cost_center_id',
        'cost_object_id',
    ];

    public function quote()
    {
        return $this->belongsTo(Quote::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
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
