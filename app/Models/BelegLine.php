<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BelegLine extends Model
{
    protected $fillable = [
        'beleg_id',
        'product_id',
        'description',
        'quantity',
        'unit',
        'unit_price',
        'tax_rate',
        'line_total',
        'account_id',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_price' => 'integer',
        'tax_rate' => 'decimal:2',
        'line_total' => 'integer',
    ];

    public function beleg()
    {
        return $this->belongsTo(Beleg::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function account()
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\Account::class);
    }
}
