<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanySetting extends Model
{
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
        ];
    }
}
