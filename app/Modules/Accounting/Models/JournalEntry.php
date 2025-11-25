<?php

namespace App\Modules\Accounting\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JournalEntry extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    protected $casts = [
        'booking_date' => 'date',
        'locked_at' => 'datetime',
    ];

    public function lines(): HasMany
    {
        return $this->hasMany(JournalEntryLine::class);
    }

    public function user()
    {
        return $this->belongsTo(\App\Models\User::class);
    }

    public function contact()
    {
        return $this->belongsTo(\App\Modules\Contacts\Models\Contact::class);
    }
}
