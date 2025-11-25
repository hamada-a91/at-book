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
    ];
}
