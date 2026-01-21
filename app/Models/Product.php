<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;

class Product extends Model
{
    use SoftDeletes, BelongsToTenant, HasPublicId;

    protected $fillable = [
        'type',
        'name',
        'description',
        'article_number',
        'gtin_ean',
        'unit',
        'price_net',
        'price_gross',
        'tax_rate',
        'track_stock',
        'stock_quantity',
        'reorder_level',
        'account_id',
        'expense_account_id',
        'category_id',
        'notes',
    ];

    protected $casts = [
        'price_net' => 'integer',
        'price_gross' => 'integer',
        'tax_rate' => 'decimal:2',
        'stock_quantity' => 'decimal:2',
        'reorder_level' => 'decimal:2',
        'track_stock' => 'boolean',
    ];

    public function account()
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\Account::class, 'account_id');
    }

    public function expenseAccount()
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\Account::class, 'expense_account_id');
    }

    public function inventoryTransactions()
    {
        return $this->hasMany(InventoryTransaction::class);
    }

    public function category()
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }
}
