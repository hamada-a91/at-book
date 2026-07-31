<?php

namespace App\Modules\Accounting\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;

class ReportAccountMapping extends Model
{
    use BelongsToTenant, HasPublicId;

    protected $guarded = ['id'];

    protected $casts = [
        'sign' => 'integer',
        'valid_from' => 'date',
        'valid_until' => 'date',
    ];
}
