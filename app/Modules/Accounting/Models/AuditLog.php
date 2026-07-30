<?php

namespace App\Modules\Accounting\Models; // Or a shared module like App\Modules\Core\Models

use App\Models\BankAccount;
use App\Models\Beleg;
use App\Models\CompanySetting;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use App\Models\Invoice;
use App\Models\TaxCode;
use App\Models\User;
use App\Modules\Contacts\Models\Contact;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Auth;

/**
 * SPEC-06: GoBD-Nachvollziehbarkeit. Append-only Protokoll aller
 * buchhaltungsrelevanten Aktionen - siehe docs/specs/SPEC-06-audit-log.md.
 *
 * Schreibzugriffe laufen AUSSCHLIESSLICH über die statische record()-Methode
 * (aus App\Modules\Accounting\Observers\AuditObserver für Standard-CRUD bzw.
 * explizit aus den Services/Controllern für fachliche Events wie
 * locked/reversed/booked/imported). Direktes AuditLog::create(...) ist zwar
 * technisch möglich (kein Schreibschutz auf create()), aber nicht der
 * vorgesehene Weg - record() übernimmt Tenant-Auflösung, Nutzer-Zuordnung,
 * IP und das Filtern sensibler Felder.
 *
 * updating()/deleting() werfen IMMER - ein Audit-Eintrag ist, einmal
 * geschrieben, unveränderlich (append-only, GoBD). Der Backup-Import ist
 * davon nicht betroffen: BackupImportService arbeitet mit
 * Model::withoutEvents(...), wodurch diese Hooks dort nicht feuern (siehe
 * app/Services/Backup/BackupImportService.php, analog zu JournalEntry).
 */
class AuditLog extends Model
{
    use BelongsToTenant, HasPublicId;

    public $timestamps = false; // Only created_at

    protected $guarded = ['id'];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Felder, die NIE in old_values/new_values landen dürfen, unabhängig
     * davon, welches Model auditiert wird (u.a. User::password).
     */
    private const SENSITIVE_FIELDS = ['password', 'remember_token'];

    /**
     * Zentrale Whitelist Kurzname <-> FQCN für alle auditierbaren Modelle.
     * Einzige Quelle der Wahrheit, wiederverwendet von:
     * - App\Http\Controllers\Api\AuditLogController (Filter-Query-Param,
     *   nimmt bewusst NIE einen rohen Klassennamen vom Client entgegen)
     * - App\Services\Backup\Transformers\AuditLogTransformer (Export)
     * - App\Services\Backup\BackupImportService (Import-Remapping)
     */
    public const AUDITABLE_TYPE_MAP = [
        'journal_entry' => JournalEntry::class,
        'invoice' => Invoice::class,
        'beleg' => Beleg::class,
        'account' => Account::class,
        'tax_code' => TaxCode::class,
        'bank_account' => BankAccount::class,
        'bank_import_batch' => \App\Models\BankImportBatch::class,
        'bank_transaction' => \App\Models\BankTransaction::class,
        'bank_matching_rule' => \App\Models\BankMatchingRule::class,
        'contact' => Contact::class,
        'user' => User::class,
        'company_setting' => CompanySetting::class,
        // SPEC-08 (Teil A)
        'project' => \App\Modules\Projects\Models\Project::class,
    ];

    public static function shortNameForClass(string $class): ?string
    {
        return array_search($class, self::AUDITABLE_TYPE_MAP, true) ?: null;
    }

    public static function classForShortName(string $shortName): ?string
    {
        return self::AUDITABLE_TYPE_MAP[$shortName] ?? null;
    }

    protected static function booted(): void
    {
        static::creating(function (self $log) {
            if (! $log->created_at) {
                $log->created_at = now();
            }
        });

        static::updating(function () {
            throw new DomainException('Audit-Einträge sind unveränderlich (append-only, GoBD) und können nicht aktualisiert werden.');
        });

        static::deleting(function () {
            throw new DomainException('Audit-Einträge sind unveränderlich (append-only, GoBD) und können nicht gelöscht werden.');
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Zentrale Schreibmethode für Audit-Einträge (append-only).
     *
     * Tenant-Auflösung: primär aus $auditable->tenant_id (funktioniert auch
     * in Jobs/Commands ohne HTTP-Kontext, siehe CLAUDE.md Regel 6), sonst
     * Fallback auf tenant(). Für alle Auditables AUSSER User ist ein
     * aufgelöster Tenant PFLICHT (Exception sonst) - User ist die einzige
     * Ausnahme, weil Plattform-Administratoren Nutzer ohne eigenen
     * Tenant-Bezug anlegen/blockieren können (siehe users.tenant_id
     * nullable seit 2026_01_17_134913).
     *
     * @param  Model  $auditable  Das auditierte Model (muss ->getKey() und
     *                            idealerweise ->tenant_id/->public_id haben).
     * @param  string  $event  z.B. 'created', 'updated', 'locked', 'reversed',
     *                         'booked', 'payment_recorded', 'file_uploaded',
     *                         'blocked', 'unblocked', 'role_changed', 'imported'.
     * @param  array  $old  Alte Werte (nur geänderte Attribute bei updates).
     * @param  array  $new  Neue Werte.
     * @param  int|null  $userId  Expliziter Benutzer (z.B. für Backup-Importe
     *                            außerhalb eines HTTP-Requests); Default:
     *                            aktuell angemeldeter Benutzer (Auth::id()),
     *                            darf null sein (Jobs ohne Nutzerkontext).
     *
     * @throws DomainException wenn kein Tenant auflösbar ist (außer bei User).
     */
    public static function record(Model $auditable, string $event, array $old = [], array $new = [], ?int $userId = null): self
    {
        $tenantId = $auditable->tenant_id ?? tenant()?->id;

        if (! $tenantId && ! $auditable instanceof User) {
            throw new DomainException(sprintf(
                'AuditLog::record() konnte keinen Tenant-Kontext für %s (Event "%s") auflösen.',
                get_class($auditable),
                $event
            ));
        }

        return self::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId ?? Auth::id(),
            'auditable_type' => get_class($auditable),
            'auditable_id' => $auditable->getKey(),
            'auditable_public_id' => $auditable->public_id ?? null,
            'event' => $event,
            'old_values' => self::filterSensitive($old),
            'new_values' => self::filterSensitive($new),
            'ip_address' => app()->runningInConsole() ? null : request()?->ip(),
        ]);
    }

    private static function filterSensitive(array $values): array
    {
        foreach (self::SENSITIVE_FIELDS as $field) {
            unset($values[$field]);
        }

        return $values;
    }
}
