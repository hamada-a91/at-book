<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\BelongsToTenant;

class BankAccount extends Model
{
    use SoftDeletes, BelongsToTenant;

    protected $fillable = [
        'name',
        'bank_name',
        'iban',
        'bic',
        'account_number',
        'bank_code',
        'currency',
        'balance',
        'type',
        'is_default',
        'notes',
        'account_id',
    ];

    protected $casts = [
        'balance' => 'integer',
        'is_default' => 'boolean',
    ];

    /**
     * Get the accounting account (Sachkonto) for this bank account
     */
    public function account()
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\Account::class);
    }

    /**
     * Get the balance formatted as currency
     */
    public function getBalanceFormattedAttribute(): string
    {
        $euros = $this->balance / 100;
        return number_format($euros, 2, ',', '.') . ' ' . $this->currency;
    }

    /**
     * Format IBAN for display (with spaces every 4 characters)
     */
    public function getFormattedIbanAttribute(): string
    {
        return chunk_split($this->iban, 4, ' ');
    }

    /**
     * Ensure only one default account per currency
     */
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($bankAccount) {
            if ($bankAccount->is_default) {
                // Un-set all other default accounts
                static::where('currency', $bankAccount->currency)
                    ->where('id', '!=', $bankAccount->id)
                    ->update(['is_default' => false]);
            }
        });
    }
}

