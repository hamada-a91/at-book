<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryNote extends Model
{
    use BelongsToTenant, SoftDeletes, HasPublicId;
    
    protected $fillable = [
        'contact_id',
        'order_id',
        'delivery_note_number',
        'delivery_date',
        'status',
        'notes',
    ];

    protected $casts = [
        'delivery_date' => 'date',
    ];

    public function contact()
    {
        return $this->belongsTo(\App\Modules\Contacts\Models\Contact::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function lines()
    {
        return $this->hasMany(DeliveryNoteLine::class);
    }
}
