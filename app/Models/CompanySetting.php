<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Concerns\BelongsToTenant;

class CompanySetting extends Model
{
    use BelongsToTenant;
    
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
        ];
    }
}
