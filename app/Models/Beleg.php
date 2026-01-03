<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\BelongsToTenant;

class Beleg extends Model
{
    use SoftDeletes, BelongsToTenant;

    protected $table = 'belege';

    protected $fillable = [
        'document_number',
        'document_type',
        'title',
        'document_date',
        'amount',
        'tax_amount',
        'contact_id',
        'category_account_id',
        'journal_entry_id',
        'file_path',
        'file_name',
        'notes',
        'status',
        'due_date',
        'is_paid',
        'payment_account_id',
    ];

    protected $casts = [
        'document_date' => 'datetime:Y-m-d',
        'due_date' => 'datetime:Y-m-d',
        'is_paid' => 'boolean',
    ];

    public function contact()
    {
        return $this->belongsTo(\App\Modules\Contacts\Models\Contact::class);
    }

    public function journalEntry()
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\JournalEntry::class);
    }

    public function categoryAccount()
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\Account::class, 'category_account_id');
    }

    public function paymentAccount()
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\Account::class, 'payment_account_id');
    }

    public function lines()
    {
        return $this->hasMany(BelegLine::class);
    }
}
