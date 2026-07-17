<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\Accounting\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * SPEC-06: GET /api/audit-logs?auditable_type=&auditable_id=&event=&from=&to=
 *
 * Nur owner/buchhalter (siehe routes/api.php, role-Middleware). Tenant-Scoping
 * geschieht automatisch über den BelongsToTenant-Global-Scope auf AuditLog
 * (der Tenant-Kontext wird von SetTenantFromUser aus dem angemeldeten User
 * gesetzt) - kein manuelles where('tenant_id', ...) hier nötig, es wäre sogar
 * redundant.
 */
class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // AuditLog::AUDITABLE_TYPE_MAP: Whitelist Kurzname -> FQCN (zentral im
        // Model gepflegt, siehe dortiger Docblock). Bewusst KEINE rohen
        // PHP-Klassennamen vom Client akzeptieren (kein Class-Enumeration-/
        // Information-Disclosure-Vektor über den Filter).
        $validated = $request->validate([
            'auditable_type' => ['nullable', 'string', Rule::in(array_keys(AuditLog::AUDITABLE_TYPE_MAP))],
            'auditable_id' => ['nullable', 'integer'],
            'event' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $query = AuditLog::with('user:id,name,email')
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if (! empty($validated['auditable_type'])) {
            $query->where('auditable_type', AuditLog::classForShortName($validated['auditable_type']));
        }

        if (! empty($validated['auditable_id'])) {
            $query->where('auditable_id', $validated['auditable_id']);
        }

        if (! empty($validated['event'])) {
            $query->where('event', $validated['event']);
        }

        if (! empty($validated['from'])) {
            $query->whereDate('created_at', '>=', $validated['from']);
        }

        if (! empty($validated['to'])) {
            $query->whereDate('created_at', '<=', $validated['to']);
        }

        return response()->json($query->paginate(20));
    }
}
