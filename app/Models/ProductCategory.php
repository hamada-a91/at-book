<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\BelongsToTenant;

class ProductCategory extends Model
{
    use SoftDeletes, BelongsToTenant;

    protected $fillable = [
        'name',
        'description',
        'color',
    ];

    public function products()
    {
        return $this->hasMany(Product::class, 'category_id');
    }
}
