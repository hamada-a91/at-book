<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\JournalEntry;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use BelongsToTenant, HasPublicId;

    protected $guarded = ['id'];

    protected $casts = [
        'payment_date' => 'date',
        'reversed_at' => 'datetime',
        'amount' => 'integer',
        'discount_amount' => 'integer',
    ];

    public function paymentAccount()
    {
        return $this->belongsTo(Account::class, 'payment_account_id');
    }

    public function discountAccount()
    {
        return $this->belongsTo(Account::class, 'discount_account_id');
    }

    public function journalEntry()
    {
        return $this->belongsTo(JournalEntry::class);
    }

    public function reversalJournalEntry()
    {
        return $this->belongsTo(JournalEntry::class, 'reversal_journal_entry_id');
    }

    public function invoice()
    {
        return $this->belongsTo(Invoice::class, 'payable_id');
    }

    public function beleg()
    {
        return $this->belongsTo(Beleg::class, 'payable_id');
    }

    public function getSettlementAmountAttribute(): int
    {
        return (int) $this->amount + (int) $this->discount_amount;
    }
}
