<?php

namespace App\Services\Backup\Transformers;

use App\Modules\Accounting\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;

/**
 * SPEC-06 (Backup-Impact): audit_logs wird MIT exportiert - die
 * GoBD-Nachvollziehbarkeit soll einen Restore überleben. Wird in der
 * EntityTransformerRegistry bewusst NACH allen anderen Entities registriert
 * (siehe dortiger Kommentar), da ein Audit-Eintrag auf JEDE andere Entity
 * verweisen kann.
 *
 * Die auditable-Referenz wird NICHT als rohe (auditable_type, auditable_id)
 * exportiert - PHP-Klassennamen sind kein stabiles, portables Format und die
 * numerische ID ist ohnehin nur im Quell-Tenant gültig. Stattdessen als
 * portables Paar (auditable_type_short, auditable_public_id), siehe
 * AuditLog::AUDITABLE_TYPE_MAP. BackupImportService::mapAuditLogAuditable()
 * löst das beim Import über die ImportIdMapping wieder auf eine neue interne
 * ID im Zieltenant auf; ist das Ziel dort nicht (mehr) auffindbar (z.B. hart
 * gelöscht), bleibt der Audit-Eintrag trotzdem erhalten (auditable_id wird
 * dann null) - die historische Information geht so nie verloren.
 */
class AuditLogTransformer extends BaseTransformer
{
    public function getModelClass(): string
    {
        return AuditLog::class;
    }

    public function transform(Model $model): array
    {
        return [
            'public_id' => $model->public_id,
            'user_public_id' => $this->getRelatedPublicId($model->user),
            'event' => $model->event,
            'auditable_type_short' => AuditLog::shortNameForClass($model->auditable_type),
            'auditable_public_id' => $model->auditable_public_id,
            'old_values' => $model->old_values,
            'new_values' => $model->new_values,
            'ip_address' => $model->ip_address,
            'created_at' => $this->formatDate($model->created_at),
        ];
    }
}
