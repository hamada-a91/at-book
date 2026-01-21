<?php

namespace App\Services\Backup\Transformers;

use Illuminate\Database\Eloquent\Model;

class ContactTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return \App\Modules\Contacts\Models\Contact::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'name' => $model->name,
            'type' => $model->type,
            'tax_number' => $model->tax_number,
            'address' => $model->address,
            'email' => $model->email,
            'phone' => $model->phone,
            'notice' => $model->notice,
            'bank_account' => $model->bank_account,
            'contact_person' => $model->contact_person,
            'customer_account_public_id' => $this->getRelatedPublicId($model->customerAccount),
            'vendor_account_public_id' => $this->getRelatedPublicId($model->vendorAccount),
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
