<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use App\Models\Concerns\HasPublicId;

class Tenant extends Model
{
    use HasFactory, HasPublicId;

    protected $fillable = [
        'name',
        'slug',
    ];

    /**
     * Get all users belonging to this tenant
     */
    public function users()
    {
        return $this->hasMany(User::class);
    }

    /**
     * Generate a unique slug from the tenant name
     */
    public static function generateSlug(string $name): string
    {
        $slug = Str::slug($name);
        $originalSlug = $slug;
        $counter = 1;

        while (self::where('slug', $slug)->exists()) {
            $slug = $originalSlug . '-' . $counter;
            $counter++;
        }

        return $slug;
    }

    /**
     * Boot the model
     */
    protected static function boot()
    {
        parent::boot();

        // Auto-generate slug if not provided
        static::creating(function ($tenant) {
            if (empty($tenant->slug)) {
                $tenant->slug = self::generateSlug($tenant->name);
            }
        });
    }
}
