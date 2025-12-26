<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Concerns\BelongsToTenant;

class TaxCode extends Model
{
    use BelongsToTenant;
    
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
