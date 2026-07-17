<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;

class CompanySetting extends Model
{
    use BelongsToTenant, HasPublicId;

    protected $fillable = [
        'company_name',
        'street',
        'zip',
        'city',
        'country',
        'tax_type',
        'logo_path',
        'tax_number',
        'email',
        'phone',
        'bank_details',
        'invoice_prefix',
        'invoice_footer_text',
        // SKR03 Account Plan Settings
        'business_models',
        'legal_form',
        'account_plan_initialized_at',
        'account_plan_last_updated_at',
        'onboarding_completed',
        // SPEC-05 (Teil B)
        'books_locked_until',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'bank_details' => 'array',
            'account_plan_initialized_at' => 'datetime',
            'account_plan_last_updated_at' => 'datetime',
            'onboarding_completed' => 'boolean',
            'books_locked_until' => 'date',
        ];
    }
}
