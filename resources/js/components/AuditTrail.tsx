import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { ChevronDown, ChevronRight, ChevronLeft, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface AuditLogEntry {
    id: number;
    event: string;
    auditable_type: string | null;
    auditable_id: number | null;
    user: { id: number; name: string; email: string } | null;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    ip_address: string | null;
    created_at: string;
}

interface PaginatedResponse {
    data: AuditLogEntry[];
    current_page: number;
    last_page: number;
    total: number;
}

const eventLabels: Record<string, string> = {
    created: 'Erstellt',
    updated: 'Geändert',
    deleted: 'Gelöscht',
    locked: 'Festgeschrieben',
    reversed: 'Storniert',
    booked: 'Gebucht',
    payment_recorded: 'Zahlung erfasst',
    period_locked: 'Periode festgeschrieben',
    file_uploaded: 'Datei hochgeladen',
    blocked: 'Gesperrt',
    unblocked: 'Entsperrt',
    role_changed: 'Rolle geändert',
    imported: 'Backup importiert',
};

const eventStyles: Record<string, string> = {
    created: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    updated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    deleted: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    locked: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    reversed: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    booked: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    period_locked: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    imported: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

// FQCN-Basename (so liefert die API auditable_type) -> deutsches Label
const typeLabels: Record<string, string> = {
    JournalEntry: 'Buchung',
    Invoice: 'Rechnung',
    Beleg: 'Beleg',
    Account: 'Konto',
    TaxCode: 'Steuerschlüssel',
    BankAccount: 'Bankkonto',
    Contact: 'Kontakt',
    User: 'Benutzer',
    CompanySetting: 'Firmeneinstellungen',
    Project: 'Projekt',
};

// Kurznamen für den API-Filter (Whitelist des Endpoints)
const filterTypes: { value: string; label: string }[] = [
    { value: 'journal_entry', label: 'Buchung' },
    { value: 'invoice', label: 'Rechnung' },
    { value: 'beleg', label: 'Beleg' },
    { value: 'account', label: 'Konto' },
    { value: 'tax_code', label: 'Steuerschlüssel' },
    { value: 'bank_account', label: 'Bankkonto' },
    { value: 'contact', label: 'Kontakt' },
    { value: 'user', label: 'Benutzer' },
    { value: 'company_setting', label: 'Firmeneinstellungen' },
    { value: 'project', label: 'Projekt' },
];

function typeLabel(fqcn: string | null): string {
    if (!fqcn) return '–';
    const base = fqcn.split('\\').pop() ?? fqcn;
    return typeLabels[base] ?? base;
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '–';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function DiffView({ entry }: { entry: AuditLogEntry }) {
    const oldValues = entry.old_values ?? {};
    const newValues = entry.new_values ?? {};
    const keys = Array.from(new Set([...Object.keys(oldValues), ...Object.keys(newValues)]));

    if (keys.length === 0) {
        return <p className="text-sm text-muted-foreground px-2 py-1">Keine Detailwerte erfasst.</p>;
    }

    return (
        <div className="overflow-x-auto rounded-md border bg-muted/30 my-1">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b text-left text-muted-foreground">
                        <th className="px-3 py-1.5 font-medium">Feld</th>
                        <th className="px-3 py-1.5 font-medium">Alt</th>
                        <th className="px-3 py-1.5 font-medium">Neu</th>
                    </tr>
                </thead>
                <tbody>
                    {keys.map((key) => (
                        <tr key={key} className="border-b last:border-0 align-top">
                            <td className="px-3 py-1.5 font-mono text-xs">{key}</td>
                            <td className="px-3 py-1.5 text-red-700 dark:text-red-400 break-all">
                                {formatValue(oldValues[key])}
                            </td>
                            <td className="px-3 py-1.5 text-emerald-700 dark:text-emerald-400 break-all">
                                {formatValue(newValues[key])}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

interface AuditTrailProps {
    /** Kurzname (API-Whitelist), z.B. 'invoice' – fixiert die Ansicht auf ein Objekt */
    auditableType?: string;
    auditableId?: number;
    /** Filterleiste anzeigen (nur für die große Audit-Log-Seite) */
    showFilters?: boolean;
    title?: string;
}

export function AuditTrail({ auditableType, auditableId, showFilters = false, title }: AuditTrailProps) {
    const [page, setPage] = useState(1);
    const [eventFilter, setEventFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>(auditableType ?? 'all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const params: Record<string, string | number> = { page };
    if (auditableType) params.auditable_type = auditableType;
    else if (typeFilter !== 'all') params.auditable_type = typeFilter;
    if (auditableId) params.auditable_id = auditableId;
    if (eventFilter !== 'all') params.event = eventFilter;
    if (fromDate) params.from = fromDate;
    if (toDate) params.to = toDate;

    const { data, isLoading, error } = useQuery<PaginatedResponse>({
        queryKey: ['audit-logs', params],
        queryFn: async () => {
            const response = await axios.get('/api/audit-logs', { params });
            return response.data;
        },
        retry: (failureCount, err: any) => err?.response?.status !== 403 && failureCount < 2,
    });

    // Kein Zugriff (z.B. Rolle cachier/manager): Komponente still ausblenden
    if ((error as any)?.response?.status === 403) {
        return null;
    }

    const entries = data?.data ?? [];

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    {title ?? 'Verlauf'}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {showFilters && (
                    <div className="mb-4 flex flex-wrap items-end gap-3">
                        {!auditableType && (
                            <div>
                                <label className="mb-1 block text-xs text-muted-foreground">Objekt-Typ</label>
                                <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Alle Typen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Alle Typen</SelectItem>
                                        {filterTypes.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Aktion</label>
                            <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); setPage(1); }}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Alle Aktionen" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Alle Aktionen</SelectItem>
                                    {Object.entries(eventLabels).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Von</label>
                            <Input type="date" className="w-[150px]" value={fromDate}
                                onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Bis</label>
                            <Input type="date" className="w-[150px]" value={toDate}
                                onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Lade Verlauf…</p>
                ) : entries.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Keine Einträge vorhanden.</p>
                ) : (
                    <div className="divide-y">
                        {entries.map((entry) => (
                            <div key={entry.id} className="py-2">
                                <button
                                    type="button"
                                    className="flex w-full flex-wrap items-center gap-2 text-left text-sm hover:bg-muted/50 rounded-md px-1 py-1"
                                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                                >
                                    {expandedId === entry.id
                                        ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                    <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                                        {new Date(entry.created_at).toLocaleString('de-DE')}
                                    </span>
                                    <Badge className={eventStyles[entry.event] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}>
                                        {eventLabels[entry.event] ?? entry.event}
                                    </Badge>
                                    {!auditableType && (
                                        <span className="text-muted-foreground">
                                            {typeLabel(entry.auditable_type)}
                                            {entry.auditable_id ? ` #${entry.auditable_id}` : ''}
                                        </span>
                                    )}
                                    <span className="ml-auto text-muted-foreground">
                                        {entry.user?.name ?? 'System'}
                                    </span>
                                </button>
                                {expandedId === entry.id && <DiffView entry={entry} />}
                            </div>
                        ))}
                    </div>
                )}

                {data && data.last_page > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                            Seite {data.current_page} von {data.last_page} · {data.total} Einträge
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}>
                                <ChevronLeft className="h-4 w-4" /> Zurück
                            </Button>
                            <Button variant="outline" size="sm" disabled={page >= data.last_page}
                                onClick={() => setPage((p) => p + 1)}>
                                Weiter <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
