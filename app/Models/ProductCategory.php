<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;

class ProductCategory extends Model
{
    use SoftDeletes, BelongsToTenant, HasPublicId;

    protected $guarded = ['id'];

    public function products()
    {
        return $this->hasMany(Product::class, 'category_id');
    }
}
