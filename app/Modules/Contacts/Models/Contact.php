<?php

namespace App\Modules\Contacts\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Contact extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'type',
        'tax_number',
        'address',
        'email',
        'phone',
        'notice',
        'bank_account',
        'contact_person',
    ];
    public function bookings()
    {
        return $this->hasMany(\App\Modules\Bookings\Models\Booking::class);
    }
}
