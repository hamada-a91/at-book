<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use App\Modules\Accounting\Models\JournalEntry;
use Illuminate\Database\Eloquent\Model;

class BankTransaction extends Model
{
    use BelongsToTenant, HasPublicId;

    public const STATUS_UNMATCHED = 'unmatched';

    public const STATUS_MATCHED = 'matched';

    public const STATUS_IGNORED = 'ignored';

    protected $guarded = ['id'];

    protected $casts = [
        'booking_date' => 'date',
        'value_date' => 'date',
        'raw' => 'array',
        'amount' => 'integer',
    ];

    public function bankAccount()
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function importBatch()
    {
        return $this->belongsTo(BankImportBatch::class, 'import_batch_id');
    }

    public function journalEntry()
    {
        return $this->belongsTo(JournalEntry::class);
    }

    public function payment()
    {
        return $this->hasOne(Payment::class);
    }

    public function getAmountAbsAttribute(): int
    {
        return abs((int) $this->amount);
    }
}
