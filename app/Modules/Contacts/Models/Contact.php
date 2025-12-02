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
        'customer_account_id',
        'vendor_account_id',
    ];
    
    public function customerAccount()
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\Account::class, 'customer_account_id');
    }

    public function vendorAccount()
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\Account::class, 'vendor_account_id');
    }
    
    // Helper to get the primary account based on type, or default to customer if both
    public function getAccountAttribute()
    {
        if ($this->type === 'vendor') {
            return $this->vendorAccount;
        }
        return $this->customerAccount;
    }

    public function bookings()
    {
        return $this->hasMany(\App\Modules\Bookings\Models\Booking::class);
    }
}
