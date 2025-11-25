<?php

namespace App\Modules\Accounting\Models;

use Illuminate\Database\Eloquent\Model;

class Account extends Model
{
    protected $guarded = ['id'];

    // e.g., '8400', 'Erlöse 19% USt', 'revenue', 'UST_19'
}
