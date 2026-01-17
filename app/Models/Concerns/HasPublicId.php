<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Trait HasPublicId
 * 
 * Adds a UUID public_id to the model and auto-generates it on creation.
 */
trait HasPublicId
{
    /**
     * Boot the trait
     */
    protected static function bootHasPublicId(): void
    {
        static::creating(function (Model $model) {
            if (empty($model->public_id)) {
                $model->public_id = (string) Str::uuid();
            }
        });
    }

    /**
     * Find a model by its public ID.
     */
    public static function findByPublicId(string $publicId): ?static
    {
        return static::where('public_id', $publicId)->first();
    }

    /**
     * Find a model by its public ID or fail.
     */
    public static function findByPublicIdOrFail(string $publicId): static
    {
        return static::where('public_id', $publicId)->firstOrFail();
    }

    /**
     * Get the route key for the model.
     * Use public_id for URLs if you want to hide internal IDs.
     * Note: This might be optional depending on your routing strategy.
     */
    // public function getRouteKeyName(): string
    // {
    //     return 'public_id';
    // }
}
