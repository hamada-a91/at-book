<?php

namespace App\Models;

use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;

class BelegLine extends Model
{
    use HasPublicId;

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
        'cost_center_id',
        'cost_object_id',
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

    /**
     * SPEC-08 (Teil A): überschreibt beim Buchen den Dokument-Default
     * (belege.project_id -> dessen cost_object_id), falls gesetzt.
     */
    public function costCenter()
    {
        return $this->belongsTo(\App\Modules\Projects\Models\CostCenter::class);
    }

    public function costObject()
    {
        return $this->belongsTo(\App\Modules\Projects\Models\CostObject::class);
    }
}
