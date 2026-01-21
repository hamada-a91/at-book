<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class CompanySettingTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Models\CompanySetting::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'company_name' => $model->company_name,
            'street' => $model->street,
            'zip' => $model->zip,
            'city' => $model->city,
            'country' => $model->country,
            'tax_type' => $model->tax_type,
            'logo_path' => $model->logo_path,
            'tax_number' => $model->tax_number,
            'email' => $model->email,
            'phone' => $model->phone,
            'bank_details' => $model->bank_details,
            'invoice_prefix' => $model->invoice_prefix,
            'invoice_footer_text' => $model->invoice_footer_text,
            'business_models' => $model->business_models,
            'legal_form' => $model->legal_form,
            'account_plan_initialized_at' => $this->formatDate($model->account_plan_initialized_at),
            'account_plan_last_updated_at' => $this->formatDate($model->account_plan_last_updated_at),
            'onboarding_completed' => $model->onboarding_completed,
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
