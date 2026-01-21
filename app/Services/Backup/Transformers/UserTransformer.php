<?php

namespace App\Services\Backup\Transformers;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class UserTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return User::class;
    }

    public function getQuery(Tenant $tenant): Builder
    {
        return User::where('tenant_id', $tenant->id)->orderBy('id');
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'name' => $model->name,
            'email' => $model->email,
            // Note: Password is hashed, we export it for restore but it cannot be recovered
            'password_hash' => $model->password,
            'email_verified_at' => $this->formatDate($model->email_verified_at),
            'remember_token' => null, // Don't export remember tokens
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
            // Export roles
            'roles' => $model->getRoleNames()->toArray(),
        ];
    }
}
