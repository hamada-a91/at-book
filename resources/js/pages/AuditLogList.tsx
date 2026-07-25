import { AuditTrail } from '@/components/AuditTrail';

/**
 * Audit-Log-Übersicht (GoBD-Nachvollziehbarkeit).
 * Sichtbar nur für owner/buchhalter – die API liefert für andere Rollen 403,
 * die AuditTrail-Komponente blendet sich dann aus.
 */
export function AuditLogList() {
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Audit-Log</h1>
                <p className="text-sm text-muted-foreground">
                    Wer hat wann was geändert – unveränderliches Protokoll aller buchhaltungsrelevanten Aktionen.
                </p>
            </div>
            <AuditTrail showFilters title="Alle Aktivitäten" />
        </div>
    );
}
