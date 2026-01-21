<?php

namespace App\Modules\Accounting\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;

class JournalEntry extends Model
{
    use SoftDeletes, BelongsToTenant, HasPublicId;

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

    public function belege()
    {
        return $this->hasMany(\App\Models\Beleg::class);
    }

    public function beleg()
    {
        return $this->belongsTo(\App\Models\Beleg::class);
    }
}
