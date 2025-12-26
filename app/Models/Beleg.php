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
        'journal_entry_id',
        'file_path',
        'file_name',
        'notes',
        'status',
        'due_date',
    ];

    protected $casts = [
        'document_date' => 'datetime:Y-m-d',
        'due_date' => 'datetime:Y-m-d',
    ];

    public function contact()
    {
        return $this->belongsTo(\App\Modules\Contacts\Models\Contact::class);
    }

    public function journalEntry()
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\JournalEntry::class);
    }
}
