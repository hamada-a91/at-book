<?php

namespace App\Services\Backup\Transformers;

use App\Models\BankMatchingRule;
use Illuminate\Database\Eloquent\Model;

class BankMatchingRuleTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return BankMatchingRule::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'match_on' => $model->match_on,
            'pattern' => $model->pattern,
            'target_type' => $model->target_type,
            'target_account_public_id' => $this->getRelatedPublicId($model->targetAccount),
            'target_contact_public_id' => $this->getRelatedPublicId($model->targetContact),
            'auto_book' => $model->auto_book,
            'confidence' => $model->confidence,
            'last_used_at' => $this->formatDate($model->last_used_at),
            'created_at' => $this->formatDate($model->created_at),
            'updated_at' => $this->formatDate($model->updated_at),
        ];
    }
}
