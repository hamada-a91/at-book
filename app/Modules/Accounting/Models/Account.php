<?php

namespace App\Modules\Accounting\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;

class Account extends Model
{
    use BelongsToTenant, HasPublicId;
    
    protected $guarded = ['id'];
    
    protected $casts = [
        'is_system' => 'boolean',
        'is_generated' => 'boolean',
        'skr03_class' => 'integer',
        'default_tax_rate' => 'decimal:2'
    ];

    // e.g., '8400', 'Erlöse 19% USt', 'revenue', 'UST_19'
    
    public function journalEntryLines()
    {
        return $this->hasMany(\App\Modules\Accounting\Models\JournalEntryLine::class);
    }
    
    /**
     * Tax Code Relationship (via default_tax_code)
     */
    public function taxCode()
    {
        return $this->hasOne(\App\Models\TaxCode::class, 'code', 'default_tax_code');
    }
}
