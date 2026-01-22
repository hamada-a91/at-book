<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SerialNumber extends Model
{
    use HasFactory;

    protected $fillable = [
        'serial_number',
        'is_used',
        'used_by_user_id',
    ];

    protected $casts = [
        'is_used' => 'boolean',
    ];

    public function usedBy()
    {
        return $this->belongsTo(User::class, 'used_by_user_id');
    }
}
