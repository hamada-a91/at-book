<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use App\Modules\Accounting\Models\Account;
use App\Modules\Contacts\Models\Contact;
use Illuminate\Database\Eloquent\Model;

class BankMatchingRule extends Model
{
    use BelongsToTenant, HasPublicId;

    protected $guarded = ['id'];

    protected $casts = [
        'auto_book' => 'boolean',
        'confidence' => 'integer',
        'last_used_at' => 'datetime',
    ];

    public function targetAccount()
    {
        return $this->belongsTo(Account::class, 'target_account_id');
    }

    public function targetContact()
    {
        return $this->belongsTo(Contact::class, 'target_contact_id');
    }
}
