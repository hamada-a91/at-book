<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaxCode extends Model
{
    protected $fillable = [
        'code',
        'name',
        'type',
        'rate',
        'account_id'
    ];

    protected $casts = [
        'rate' => 'decimal:2'
    ];

    /**
     * Verknüpfung zum Steuerkonto
     * 
     * @return BelongsTo
     */
    public function account(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\Account::class);
    }
}
