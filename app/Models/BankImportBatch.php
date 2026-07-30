<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;

class BankImportBatch extends Model
{
    use BelongsToTenant, HasPublicId;

    protected $guarded = ['id'];

    protected $casts = [
        'settings' => 'array',
        'skipped_rows' => 'array',
        'total_rows' => 'integer',
        'imported_count' => 'integer',
        'skipped_count' => 'integer',
    ];

    public function bankAccount()
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function transactions()
    {
        return $this->hasMany(BankTransaction::class, 'import_batch_id');
    }
}
