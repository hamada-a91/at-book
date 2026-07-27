<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Beleg extends Model
{
    use BelongsToTenant, HasPublicId, SoftDeletes;

    protected $table = 'belege';

    protected $fillable = [
        'document_number',
        'document_type',
        'title',
        'document_date',
        'amount',
        'tax_amount',
        'amount_paid',
        'contact_id',
        'project_id',
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
        'amount_paid' => 'integer',
    ];

    protected $appends = [
        'open_amount',
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

    public function payments()
    {
        return $this->hasMany(Payment::class, 'payable_id')
            ->where('payable_type', 'beleg');
    }

    public function getOpenAmountAttribute(): int
    {
        return max(0, (int) $this->amount - (int) $this->amount_paid);
    }

    /**
     * SPEC-08 (Teil A): Default-Kostenträger-Zuordnung fürs ganze Dokument
     * (Durchreich-Logik in BelegController::book()).
     */
    public function project()
    {
        return $this->belongsTo(\App\Modules\Projects\Models\Project::class);
    }
}
