import React, { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { format } from 'date-fns';
import {
    FileText,
    TrendingUp,
    Scale,
    List,
    Activity,
    Receipt,
    Download,
    Printer,
    SlidersHorizontal,
    Plus,
    Trash2,
    Check,
    X,
    AlertTriangle,
    AlertCircle,
    Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { DateRangeSelector } from '@/components/reports/DateRangeSelector';
import { ReportCard } from '@/components/reports/ReportCard';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';

type ReportType = 'trial-balance' | 'profit-loss' | 'balance-sheet' | 'journal-export' | 'account-movements' | 'tax-report' | 'bwa' | 'ustva';

export function Reports() {
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
        from: new Date(),
        to: new Date()
    });
    const [activeReport, setActiveReport] = useState<ReportType | null>(null);
    const [reportData, setReportData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [basis, setBasis] = useState<'posted' | 'preview'>('posted');
    const [expandedKzs, setExpandedKzs] = useState<Record<string, boolean>>({});

    // Mappings Editor State
    const [mappingEditorOpen, setMappingEditorOpen] = useState(false);
    const [mappingReportType, setMappingReportType] = useState<'bwa' | 'ustva'>('bwa');
    const [mappingData, setMappingData] = useState<any>(null);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccountPublicId, setSelectedAccountPublicId] = useState('');
    const [selectedTargetCode, setSelectedTargetCode] = useState('');
    const [selectedValueType, setSelectedValueType] = useState<string>('balance');
    const [selectedSign, setSelectedSign] = useState<number>(1);
    const [isSavingMappings, setIsSavingMappings] = useState(false);

    // Search queries for filtering accounts
    const [accountSearchQuery, setAccountSearchQuery] = useState('');
    const [mappingAccountSearchQuery, setMappingAccountSearchQuery] = useState('');

    // Selected account for Kontobewegungen report
    const [selectedMovementAccountId, setSelectedMovementAccountId] = useState<number | null>(null);

    // Fetch current user details to check for 'owner' role
    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: async () => {
            const response = await axios.get('/api/user');
            return response.data.user;
        },
    });

    const isOwner = currentUser?.roles?.some((role: any) => role.name === 'owner') || false;

    // Filter accounts based on search query for Kontobewegungen (defensive)
    const filteredAccounts = accounts.filter(acc => {
        const code = acc.code || '';
        const name = acc.name || '';
        return code.toLowerCase().includes(accountSearchQuery.toLowerCase()) ||
               name.toLowerCase().includes(accountSearchQuery.toLowerCase());
    });

    // Filter accounts based on search query for Mapping Editor (defensive)
    const filteredMappingAccounts = accounts.filter(acc => {
        const code = acc.code || '';
        const name = acc.name || '';
        return code.toLowerCase().includes(mappingAccountSearchQuery.toLowerCase()) ||
               name.toLowerCase().includes(mappingAccountSearchQuery.toLowerCase());
    });

    // Update selected mapping account if the current one is filtered out
    useEffect(() => {
        if (filteredMappingAccounts.length > 0) {
            const stillExists = filteredMappingAccounts.some(acc => acc.public_id === selectedAccountPublicId);
            if (!stillExists) {
                setSelectedAccountPublicId(filteredMappingAccounts[0].public_id);
            }
        } else {
            setSelectedAccountPublicId('');
        }
    }, [mappingAccountSearchQuery, accounts]);

    const handleGenerateReport = async (type: ReportType, accountId?: number) => {
        setIsLoading(true);
        setActiveReport(type);
        
        // Fetch accounts list if not already populated (needed for account-movements or mapping editor)
        if ((type === 'account-movements' || mappingEditorOpen) && accounts.length === 0) {
            await loadAccounts();
        }

        const idToUse = accountId || selectedMovementAccountId;
        if (type === 'account-movements' && !idToUse) {
            setReportData(null);
            setIsLoading(false);
            return;
        }

        setReportData(null);
        setExpandedKzs({});

        try {
            const queryParams = new URLSearchParams();
            if (type === 'ustva') {
                const year = format(dateRange.from, 'yyyy');
                const month = format(dateRange.from, 'M');
                queryParams.append('year', year);
                queryParams.append('month', month);
                queryParams.append('basis', 'posted'); // Force posted on USt-VA as preview is blocked
            } else {
                queryParams.append('from_date', format(dateRange.from, 'yyyy-MM-dd'));
                queryParams.append('to_date', format(dateRange.to, 'yyyy-MM-dd'));
                queryParams.append('basis', basis);
            }

            if (type === 'account-movements' && idToUse) {
                queryParams.append('account_id', String(idToUse));
            }

            const { data } = await axios.get(`/api/reports/${type}?${queryParams}`);
            setReportData(data);
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.message || 'Fehler beim Erstellen des Berichts');
            setActiveReport(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegenerateReport = async (newBasis: 'posted' | 'preview') => {
        if (!activeReport) return;
        
        const idToUse = selectedMovementAccountId;
        if (activeReport === 'account-movements' && !idToUse) {
            return;
        }

        setIsLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (activeReport === 'ustva') {
                const year = format(dateRange.from, 'yyyy');
                const month = format(dateRange.from, 'M');
                queryParams.append('year', year);
                queryParams.append('month', month);
                queryParams.append('basis', 'posted');
            } else {
                queryParams.append('from_date', format(dateRange.from, 'yyyy-MM-dd'));
                queryParams.append('to_date', format(dateRange.to, 'yyyy-MM-dd'));
                queryParams.append('basis', newBasis);
            }

            if (activeReport === 'account-movements' && idToUse) {
                queryParams.append('account_id', String(idToUse));
            }

            const { data } = await axios.get(`/api/reports/${activeReport}?${queryParams}`);
            setReportData(data);
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.message || 'Fehler beim Aktualisieren des Berichts');
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount / 100);
    };

    const formatPercent = (val: number | null) => {
        if (val === null) return '-';
        return new Intl.NumberFormat('de-DE', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' %';
    };

    const handleDownloadReport = async (formatType: 'pdf' | 'csv') => {
        if (!activeReport) return;

        let downloadUrl = `/api/reports/${activeReport}/export`;
        const queryParams = new URLSearchParams();

        if (activeReport === 'ustva') {
            downloadUrl = `/api/reports/ustva/transfer-sheet`;
            queryParams.append('year', format(dateRange.from, 'yyyy'));
            queryParams.append('month', format(dateRange.from, 'M'));
        } else {
            queryParams.append('from_date', format(dateRange.from, 'yyyy-MM-dd'));
            queryParams.append('to_date', format(dateRange.to, 'yyyy-MM-dd'));
            queryParams.append('basis', basis);
        }

        if (activeReport === 'account-movements') {
            if (!selectedMovementAccountId) {
                alert('Bitte wählen Sie zuerst ein Konto aus.');
                return;
            }
            queryParams.append('account_id', String(selectedMovementAccountId));
        }

        queryParams.append('format', formatType);

        try {
            const response = await axios.get(`${downloadUrl}?${queryParams}`, {
                responseType: 'blob',
            });
            const blob = new Blob([response.data], {
                type: formatType === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8',
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${activeReport}_${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}.${formatType}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error(error);
            if (error.response?.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const errData = JSON.parse(text);
                    alert(errData.message || 'Fehler beim Export des Berichts');
                    if (errData.quality) {
                        setReportData((prev: any) => ({
                            ...prev,
                            quality: errData.quality
                        }));
                    }
                } catch (e) {
                    alert('Fehler beim Export des Berichts');
                }
            } else {
                alert(error.response?.data?.message || 'Fehler beim Export des Berichts');
            }
        }
    };

    // Mappings Management Actions
    const loadMappings = async (type: 'bwa' | 'ustva') => {
        try {
            const { data } = await axios.get(`/api/report-mappings/${type}`);
            setMappingData(data);
            
            const targets = Object.keys(data.target_codes);
            if (targets.length > 0) {
                setSelectedTargetCode(targets[0]);
            }
            
            if (type === 'ustva') {
                setSelectedValueType('base_amount');
            } else {
                setSelectedValueType('balance');
            }
        } catch (error) {
            console.error('Error loading mappings:', error);
            alert('Fehler beim Laden der Kontenzuordnungen.');
        }
    };

    const loadAccounts = async () => {
        try {
            const { data } = await axios.get('/api/accounts');
            setAccounts(data);
            if (data.length > 0) {
                setSelectedAccountPublicId(data[0].public_id);
            }
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    };

    const handleAddMappingLocal = () => {
        if (!selectedAccountPublicId || !selectedTargetCode || !mappingData) return;
        
        const account = accounts.find(a => a.public_id === selectedAccountPublicId);
        if (!account) return;
        
        const exists = mappingData.mappings.some(
            (m: any) => m.source_public_id === selectedAccountPublicId && m.target_code === selectedTargetCode
        );
        if (exists) {
            alert('Dieses Konto ist bereits dieser Ziel-Kategorie zugeordnet.');
            return;
        }

        const newMapping = {
            source_type: 'account',
            source_public_id: selectedAccountPublicId,
            target_code: selectedTargetCode,
            value_type: selectedValueType,
            sign: selectedSign,
            valid_from: null,
            valid_until: null,
            source: {
                code: account.code,
                name: account.name
            }
        };

        setMappingData((prev: any) => ({
            ...prev,
            mappings: [...prev.mappings, newMapping]
        }));
    };

    const handleRemoveMappingLocal = (indexToRemove: number) => {
        if (!mappingData) return;
        setMappingData((prev: any) => ({
            ...prev,
            mappings: prev.mappings.filter((_: any, idx: number) => idx !== indexToRemove)
        }));
    };

    const handleSaveMappings = async () => {
        if (!mappingData) return;
        setIsSavingMappings(true);
        try {
            const payload = {
                form_version: mappingData.form_version,
                mappings: mappingData.mappings.map((m: any) => ({
                    source_type: m.source_type,
                    source_public_id: m.source_public_id,
                    target_code: m.target_code,
                    value_type: m.value_type,
                    sign: m.sign,
                    valid_from: m.valid_from,
                    valid_until: m.valid_until
                }))
            };
            
            const { data } = await axios.put(`/api/report-mappings/${mappingReportType}`, payload);
            setMappingData(data);
            alert('Zuordnungen erfolgreich gespeichert!');
            setMappingEditorOpen(false);
        } catch (error: any) {
            console.error('Error saving mappings:', error);
            alert(error.response?.data?.message || 'Fehler beim Speichern der Zuordnungen.');
        } finally {
            setIsSavingMappings(false);
        }
    };

    // Quality warnings and blocking errors section
    const renderQualitySection = () => {
        if (!reportData || !reportData.quality) return null;
        const { status, warnings, blocking_errors } = reportData.quality;

        if (status === 'ok' && (!warnings || warnings.length === 0) && (!blocking_errors || blocking_errors.length === 0)) {
            return (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-200 dark:border-emerald-900/50 text-sm mb-4">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-semibold">Datenqualität: OK</span>
                </div>
            );
        }

        return (
            <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Datenqualität:</span>
                    {status === 'error' || (blocking_errors && blocking_errors.length > 0) ? (
                        <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Fehler
                        </Badge>
                    ) : (
                        <Badge variant="warning" className="flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Warnung
                        </Badge>
                    )}
                </div>

                {blocking_errors && blocking_errors.length > 0 && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-md text-sm space-y-1">
                        <div className="font-semibold text-rose-800 dark:text-rose-400">Blockierende Fehler (Übertragungsbogen gesperrt):</div>
                        <ul className="list-disc list-inside space-y-1 text-rose-700 dark:text-rose-300">
                            {blocking_errors.map((err: any, i: number) => (
                                <li key={i}>
                                    {err.message} {err.affected_count !== undefined && `(${err.affected_count} Betroffene)`}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {warnings && warnings.length > 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-md text-sm space-y-1">
                        <div className="font-semibold text-amber-800 dark:text-amber-400">Hinweise / Warnungen:</div>
                        <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-300">
                            {warnings.map((warn: any, i: number) => (
                                <li key={i}>
                                    {warn.message} {warn.affected_count !== undefined && `(${warn.affected_count} Betroffene)`}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    const renderBwaReport = () => {
        if (!reportData?.data?.rows) return null;
        
        return (
            <div className="space-y-4">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-24">Zeile</TableHead>
                            <TableHead>Bezeichnung</TableHead>
                            <TableHead className="text-right">Monat (Periode)</TableHead>
                            <TableHead className="text-right">Kumuliert (YTD)</TableHead>
                            <TableHead className="text-right">Vorjahr</TableHead>
                            <TableHead className="text-right">Abweichung</TableHead>
                            <TableHead className="text-right">%</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportData.data.rows.map((row: any) => {
                            const isCalc = row.type === 'calculated';
                            const isPositive = row.month_value >= 0;
                            const valColor = isCalc ? (isPositive ? 'text-green-600 dark:text-green-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold') : '';

                            return (
                                <TableRow key={row.code} className={isCalc ? "font-bold bg-slate-50 dark:bg-slate-800/50" : ""}>
                                    <TableCell className="font-mono">{row.code}</TableCell>
                                    <TableCell className={isCalc ? "font-bold text-slate-900 dark:text-slate-100" : ""}>{row.label}</TableCell>
                                    <TableCell className={`text-right ${valColor}`}>{formatCurrency(row.month_value)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(row.year_to_date_value)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(row.previous_year_value)}</TableCell>
                                    <TableCell className={`text-right font-mono ${row.deviation_amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                        {row.deviation_amount > 0 ? '+' : ''}{formatCurrency(row.deviation_amount)}
                                    </TableCell>
                                    <TableCell className={`text-right font-mono ${row.deviation_percent && row.deviation_percent < 0 ? 'text-red-600 dark:text-red-400' : row.deviation_percent && row.deviation_percent > 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                        {row.deviation_percent > 0 ? '+' : ''}{formatPercent(row.deviation_percent)}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        );
    };

    const toggleKz = (kz: string) => {
        setExpandedKzs(prev => ({ ...prev, [kz]: !prev[kz] }));
    };

    const renderUstvaReport = () => {
        if (!reportData?.data?.kennziffern) return null;

        return (
            <div className="space-y-6">
                {reportData.data.manual_transfer_notice && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-900 rounded-lg flex items-start gap-3">
                        <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div>
                            <h4 className="font-semibold text-amber-900 dark:text-amber-400">Manueller Übertragungs-Hinweis</h4>
                            <p className="text-sm text-amber-800 dark:text-amber-300">
                                {reportData.data.manual_transfer_notice}
                            </p>
                        </div>
                    </div>
                )}

                <div className="border rounded-md overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-24">Kennziffer</TableHead>
                                <TableHead>Bezeichnung</TableHead>
                                <TableHead className="text-right w-64">Betrag / Steuer</TableHead>
                                <TableHead className="w-24"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.data.kennziffern.map((row: any) => {
                                const hasHerleitung = (row.herleitung && row.herleitung.length > 0) || (row.tax_herleitung && row.tax_herleitung.length > 0);
                                const isExpanded = expandedKzs[row.kennziffer];
                                const isCalculated = row.kennziffer === '83';

                                return (
                                    <React.Fragment key={row.kennziffer}>
                                        <TableRow className={`${isCalculated ? "bg-slate-50 dark:bg-slate-800 font-bold" : ""} hover:bg-slate-100/50 dark:hover:bg-slate-800/50`}>
                                            <TableCell className="font-mono font-bold text-slate-700 dark:text-slate-300">{row.kennziffer}</TableCell>
                                            <TableCell className={isCalculated ? "font-bold" : ""}>{row.label}</TableCell>
                                            <TableCell className="text-right">
                                                {row.kennziffer === '81' || row.kennziffer === '86' ? (
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-sm font-semibold">{formatCurrency(row.amount)} <span className="text-xs text-muted-foreground">(Basis)</span></span>
                                                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">USt: {formatCurrency(row.tax_amount)}</span>
                                                    </div>
                                                ) : row.kennziffer === '83' ? (
                                                    <span className={`text-lg font-bold ${row.amount < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                        {formatCurrency(row.amount)}
                                                    </span>
                                                ) : (
                                                    <span className="font-semibold">{formatCurrency(row.amount)}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {hasHerleitung && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleKz(row.kennziffer)}
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        {isExpanded ? '▲' : '▼'}
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>

                                        {hasHerleitung && isExpanded && (
                                            <TableRow className="bg-slate-50/50 dark:bg-slate-900/30">
                                                <TableCell colSpan={4} className="p-4 border-t border-b">
                                                    <div className="space-y-4 pl-8">
                                                        {row.herleitung && row.herleitung.length > 0 && (
                                                            <div>
                                                                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Herleitung Bemessungsgrundlage:</div>
                                                                <Table className="bg-white dark:bg-slate-950 border rounded-md">
                                                                    <TableHeader>
                                                                        <TableRow className="h-8">
                                                                            <TableHead className="text-xs h-8">Konto</TableHead>
                                                                            <TableHead className="text-xs h-8">Name</TableHead>
                                                                            <TableHead className="text-xs h-8">Werttyp</TableHead>
                                                                            <TableHead className="text-right text-xs h-8">Betrag</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {row.herleitung.map((hl: any, idx: number) => (
                                                                            <TableRow key={idx} className="h-8">
                                                                                <TableCell className="font-mono text-xs py-1">{hl.account_code}</TableCell>
                                                                                <TableCell className="text-xs py-1">{hl.account_name}</TableCell>
                                                                                <TableCell className="text-xs py-1 font-mono text-slate-500">{hl.value_type}</TableCell>
                                                                                <TableCell className="text-right text-xs py-1 font-semibold">{formatCurrency(hl.amount)}</TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        )}

                                                        {row.tax_herleitung && row.tax_herleitung.length > 0 && (
                                                            <div>
                                                                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Herleitung Steuerbetrag:</div>
                                                                <Table className="bg-white dark:bg-slate-950 border rounded-md">
                                                                    <TableHeader>
                                                                        <TableRow className="h-8">
                                                                            <TableHead className="text-xs h-8">Konto</TableHead>
                                                                            <TableHead className="text-xs h-8">Name</TableHead>
                                                                            <TableHead className="text-xs h-8">Werttyp</TableHead>
                                                                            <TableHead className="text-right text-xs h-8">Betrag</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {row.tax_herleitung.map((hl: any, idx: number) => (
                                                                            <TableRow key={idx} className="h-8">
                                                                                <TableCell className="font-mono text-xs py-1">{hl.account_code}</TableCell>
                                                                                <TableCell className="text-xs py-1">{hl.account_name}</TableCell>
                                                                                <TableCell className="text-xs py-1 font-mono text-slate-500">{hl.value_type}</TableCell>
                                                                                <TableCell className="text-right text-xs py-1 font-semibold">{formatCurrency(hl.amount)}</TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    };

    const renderAccountMovementsReport = () => {
        return (
            <div className="space-y-6">
                {/* Account Search & Select List */}
                <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900 p-4 border rounded-lg">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Konto suchen und auswählen:</label>
                    <input
                        type="text"
                        placeholder="Konto filtern nach Nummer oder Name (z.B. 1200 oder Bank)..."
                        value={accountSearchQuery}
                        onChange={(e) => setAccountSearchQuery(e.target.value)}
                        className="text-xs p-2.5 rounded border bg-background border-slate-300 dark:border-slate-700 w-full h-9 mb-1"
                    />
                    <div className="border rounded-md max-h-48 overflow-y-auto bg-white dark:bg-slate-950 divide-y shadow-inner">
                        {filteredAccounts.map(acc => (
                            <button
                                key={acc.id}
                                type="button"
                                onClick={() => {
                                    setSelectedMovementAccountId(acc.id);
                                    handleGenerateReport('account-movements', acc.id);
                                }}
                                className={`w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-xs flex justify-between items-center ${
                                    selectedMovementAccountId === acc.id
                                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                                        : 'text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                <span>{acc.code} - {acc.name}</span>
                                {selectedMovementAccountId === acc.id && <Check className="w-4 h-4 text-blue-500" />}
                            </button>
                        ))}
                        {filteredAccounts.length === 0 && (
                            <div className="p-3 text-slate-500 text-center text-xs">
                                Keine Konten gefunden
                            </div>
                        )}
                    </div>
                </div>

                {reportData ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm">
                            <div>
                                <div className="text-slate-500 dark:text-slate-400 text-xs">Anfangssaldo</div>
                                <div className="font-bold text-base mt-0.5">{formatCurrency(reportData.totals.opening_balance)}</div>
                            </div>
                            <div>
                                <div className="text-slate-500 dark:text-slate-400 text-xs">Soll gesamt</div>
                                <div className="font-bold text-base mt-0.5 text-blue-600 dark:text-blue-400">{formatCurrency(reportData.totals.debit)}</div>
                            </div>
                            <div>
                                <div className="text-slate-500 dark:text-slate-400 text-xs">Haben gesamt</div>
                                <div className="font-bold text-base mt-0.5 text-emerald-600 dark:text-emerald-400">{formatCurrency(reportData.totals.credit)}</div>
                            </div>
                            <div>
                                <div className="text-slate-500 dark:text-slate-400 text-xs">Endsaldo</div>
                                <div className="font-bold text-base mt-0.5">{formatCurrency(reportData.totals.closing_balance)}</div>
                            </div>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Beleg-Nr.</TableHead>
                                    <TableHead>Beschreibung</TableHead>
                                    <TableHead className="text-right">Soll</TableHead>
                                    <TableHead className="text-right">Haben</TableHead>
                                    <TableHead className="text-right">Laufender Saldo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.data.movements.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-slate-500 py-6 text-sm">
                                            Keine Bewegungen im gewählten Zeitraum vorhanden.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    reportData.data.movements.map((move: any, idx: number) => (
                                        <TableRow key={idx} className="hover:bg-slate-50/50">
                                            <TableCell className="text-xs">{format(new Date(move.booking_date), 'dd.MM.yyyy')}</TableCell>
                                            <TableCell className="font-mono text-xs">#{move.entry_id}</TableCell>
                                            <TableCell className="text-xs">{move.description}</TableCell>
                                            <TableCell className="text-right text-xs text-blue-600 dark:text-blue-400">{move.debit > 0 ? formatCurrency(move.debit) : ''}</TableCell>
                                            <TableCell className="text-right text-xs text-emerald-600 dark:text-emerald-400">{move.credit > 0 ? formatCurrency(move.credit) : ''}</TableCell>
                                            <TableCell className="text-right font-mono text-xs font-semibold">{formatCurrency(move.running_balance)}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="text-center text-slate-500 py-12 text-sm border border-dashed rounded-lg bg-slate-50/50">
                        Bitte filtern und wählen Sie ein Konto aus der obigen Liste aus, um die Kontobewegungen anzuzeigen.
                    </div>
                )}
            </div>
        );
    };

    const renderReportContent = () => {
        if (!reportData && activeReport !== 'account-movements') return null;

        switch (activeReport) {
            case 'trial-balance':
                return (
                    <div className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Konto</TableHead>
                                    <TableHead>Bezeichnung</TableHead>
                                    <TableHead className="text-right">Soll</TableHead>
                                    <TableHead className="text-right">Haben</TableHead>
                                    <TableHead className="text-right">Saldo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.data.map((row: any) => (
                                    <TableRow key={row.account_id}>
                                        <TableCell className="font-mono">{row.code}</TableCell>
                                        <TableCell>{row.name}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(row.total_debit)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(row.total_credit)}</TableCell>
                                        <TableCell className="text-right font-bold">
                                            <span className={row.balance < 0 ? 'text-red-600' : 'text-green-600'}>
                                                {formatCurrency(row.balance)}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-slate-50 dark:bg-slate-800 font-bold">
                                    <TableCell colSpan={2}>Summe</TableCell>
                                    <TableCell className="text-right">{formatCurrency(reportData.totals.debit)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(reportData.totals.credit)}</TableCell>
                                    <TableCell className="text-right"></TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                );

            case 'profit-loss':
                return (
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-emerald-600">Erlöse (Erträge)</h3>
                            <Table>
                                <TableBody>
                                    {reportData.revenues.map((row: any) => (
                                        <TableRow key={row.code}>
                                            <TableCell className="font-mono w-24">{row.code}</TableCell>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-emerald-50 dark:bg-emerald-900/20 font-bold">
                                        <TableCell colSpan={2}>Summe Erlöse</TableCell>
                                        <TableCell className="text-right">{formatCurrency(reportData.total_revenue)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-rose-600">Aufwendungen</h3>
                            <Table>
                                <TableBody>
                                    {reportData.expenses.map((row: any) => (
                                        <TableRow key={row.code}>
                                            <TableCell className="font-mono w-24">{row.code}</TableCell>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-rose-50 dark:bg-rose-900/20 font-bold">
                                        <TableCell colSpan={2}>Summe Aufwendungen</TableCell>
                                        <TableCell className="text-right">{formatCurrency(reportData.total_expense)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex justify-between items-center p-6 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            <span className="text-xl font-bold">Vorläufiges Ergebnis</span>
                            <span className={`text-2xl font-bold ${reportData.net_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {formatCurrency(reportData.net_profit)}
                            </span>
                        </div>
                    </div>
                );

            case 'balance-sheet':
                return (
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Aktiva</h3>
                            <Table>
                                <TableBody>
                                    {reportData.assets.map((row: any) => (
                                        <TableRow key={row.code}>
                                            <TableCell className="font-mono w-20">{row.code}</TableCell>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(row.balance)}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-slate-100 dark:bg-slate-800 font-bold text-lg">
                                        <TableCell colSpan={2}>Summe Aktiva</TableCell>
                                        <TableCell className="text-right">{formatCurrency(reportData.total_assets)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Passiva</h3>
                            <Table>
                                <TableBody>
                                    {reportData.equity.map((row: any) => (
                                        <TableRow key={row.code}>
                                            <TableCell className="font-mono w-20">{row.code}</TableCell>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(row.balance)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {reportData.liabilities.map((row: any) => (
                                        <TableRow key={row.code}>
                                            <TableCell className="font-mono w-20">{row.code}</TableCell>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(row.balance)}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-slate-50 dark:bg-slate-800/50 italic">
                                        <TableCell colSpan={2}>Jahresüberschuss/-fehlbetrag</TableCell>
                                        <TableCell className="text-right">{formatCurrency(reportData.calculated_profit_loss)}</TableCell>
                                    </TableRow>
                                    <TableRow className="bg-slate-100 dark:bg-slate-800 font-bold text-lg">
                                        <TableCell colSpan={2}>Summe Passiva</TableCell>
                                        <TableCell className="text-right">{formatCurrency(reportData.total_liabilities + reportData.total_equity + reportData.calculated_profit_loss)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                );

            case 'journal-export':
                return (
                    <div className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Beleg</TableHead>
                                    <TableHead>Beschreibung</TableHead>
                                    <TableHead>Soll</TableHead>
                                    <TableHead>Haben</TableHead>
                                    <TableHead className="text-right">Betrag</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.entries.map((entry: any) => (
                                    entry.lines.map((line: any, index: number) => (
                                        <TableRow key={`${entry.id}-${line.id}`} className={index === 0 ? "border-t-2 border-slate-100 dark:border-slate-800" : ""}>
                                            <TableCell>{index === 0 ? format(new Date(entry.booking_date), 'dd.MM.yyyy') : ''}</TableCell>
                                            <TableCell>{index === 0 ? `#${entry.id}` : ''}</TableCell>
                                            <TableCell>{index === 0 ? entry.description : ''}</TableCell>
                                            <TableCell>{line.type === 'debit' ? `${line.account.code} ${line.account.name}` : ''}</TableCell>
                                            <TableCell>{line.type === 'credit' ? `${line.account.code} ${line.account.name}` : ''}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(line.amount)}</TableCell>
                                        </TableRow>
                                    ))
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                );

            case 'tax-report':
                return (
                    <div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {Object.values(reportData.tax_summary).map((item: any) => (
                                <div key={item.tax_key} className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                                    <div className="text-sm font-medium text-muted-foreground mb-2">Steuerschlüssel {item.tax_key}</div>
                                    <div className="text-2xl font-bold mb-1">{formatCurrency(item.tax_amount)}</div>
                                    <div className="text-xs text-muted-foreground">Basis: {formatCurrency(item.base_amount)}</div>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800 flex justify-between items-center">
                            <span className="font-bold">Gesamtsteuer</span>
                            <span className="text-xl font-bold">{formatCurrency(reportData.total_tax_amount)}</span>
                        </div>
                    </div>
                );

            case 'bwa':
                return renderBwaReport();

            case 'ustva':
                return renderUstvaReport();

            case 'account-movements':
                return renderAccountMovementsReport();

            default:
                return <p>Bericht wird geladen...</p>;
        }
    };

    const getReportTitle = (type: ReportType) => {
        switch (type) {
            case 'trial-balance': return 'Summen- und Saldenliste';
            case 'profit-loss': return 'Gewinn- und Verlustrechnung';
            case 'balance-sheet': return 'Bilanz';
            case 'journal-export': return 'Journal';
            case 'account-movements': return 'Kontobewegungen';
            case 'tax-report': return 'USt-Voranmeldung (Alt)';
            case 'bwa': return 'Betriebswirtschaftliche Auswertung (BWA)';
            case 'ustva': return 'USt-Voranmeldung';
            default: return 'Bericht';
        }
    };

    const hasBlockingErrors = reportData?.quality?.blocking_errors?.length > 0;

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Journal & Berichte</h1>
                    <p className="text-slate-500 dark:text-slate-400">Finanzberichte und Auswertungen erstellen</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {isOwner && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setMappingEditorOpen(true);
                                loadAccounts();
                                loadMappings(mappingReportType);
                            }}
                            className="flex items-center gap-2 border-slate-300 dark:border-slate-600 shadow-sm"
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                            Zuordnungen verwalten
                        </Button>
                    )}
                    <DateRangeSelector onRangeChange={(from, to) => setDateRange({ from, to })} />
                </div>
            </div>

            {/* Reports Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <ReportCard
                    title="Summen- und Saldenliste"
                    description="Übersicht aller Kontensalden und Bewegungen im gewählten Zeitraum."
                    icon={List}
                    color="text-blue-600"
                    onClick={() => handleGenerateReport('trial-balance')}
                />
                <ReportCard
                    title="Gewinn- und Verlustrechnung"
                    description="Gegenüberstellung von Erträgen und Aufwendungen zur Ermittlung des Erfolgs."
                    icon={TrendingUp}
                    color="text-emerald-600"
                    onClick={() => handleGenerateReport('profit-loss')}
                />
                <ReportCard
                    title="Bilanz"
                    description="Gegenüberstellung von Vermögen (Aktiva) und Kapital (Passiva)."
                    icon={Scale}
                    color="text-purple-600"
                    onClick={() => handleGenerateReport('balance-sheet')}
                />
                <ReportCard
                    title="BWA"
                    description="Betriebswirtschaftliche Auswertung zur laufenden Erfolgskontrolle des Unternehmens."
                    icon={TrendingUp}
                    color="text-teal-600"
                    onClick={() => handleGenerateReport('bwa')}
                />
                <ReportCard
                    title="Journal"
                    description="Detaillierte Auflistung aller Buchungssätze im gewählten Zeitraum."
                    icon={FileText}
                    color="text-amber-600"
                    onClick={() => handleGenerateReport('journal-export')}
                />
                <ReportCard
                    title="Kontobewegungen"
                    description="Detaillierte Ansicht aller Buchungen auf einem spezifischen Konto."
                    icon={Activity}
                    color="text-indigo-600"
                    onClick={() => handleGenerateReport('account-movements')}
                />
                <ReportCard
                    title="USt-Voranmeldung"
                    description="Amtliche Kennziffern und Eingabehilfe für die Umsatzsteuer-Voranmeldung."
                    icon={Receipt}
                    color="text-rose-600"
                    onClick={() => handleGenerateReport('ustva')}
                />
            </div>

            {/* Report Dialog */}
            <Dialog open={!!activeReport} onOpenChange={(open) => !open && setActiveReport(null)}>
                <DialogContent className="max-w-[90vw] h-[90vh] flex flex-col">
                    <DialogHeader className="border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <DialogTitle className="flex items-center gap-2 text-2xl">
                                {activeReport && getReportTitle(activeReport)}
                                <span className="text-sm font-normal text-slate-500 ml-4">
                                    {activeReport === 'ustva'
                                        ? format(dateRange.from, 'MMMM yyyy')
                                        : `${format(dateRange.from, 'dd.MM.yyyy')} - ${format(dateRange.to, 'dd.MM.yyyy')}`}
                                </span>
                            </DialogTitle>
                            <DialogDescription className="mt-1">
                                Vorschau des Berichts. Nutzen Sie die Export-Funktionen für die Weiterverarbeitung.
                            </DialogDescription>
                        </div>
                        
                        {/* Basis Switcher */}
                        <div className="flex items-center gap-3 pr-6">
                            {activeReport && activeReport !== 'ustva' && (
                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-md text-xs">
                                    <button
                                        onClick={() => { setBasis('posted'); handleRegenerateReport('posted'); }}
                                        className={`px-3 py-1.5 rounded-sm transition-all ${basis === 'posted' ? 'bg-white dark:bg-slate-950 shadow text-slate-900 dark:text-slate-100 font-semibold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                                    >
                                        Festgeschrieben (Standard)
                                    </button>
                                    <button
                                        onClick={() => { setBasis('preview'); handleRegenerateReport('preview'); }}
                                        className={`px-3 py-1.5 rounded-sm transition-all ${basis === 'preview' ? 'bg-white dark:bg-slate-950 shadow text-slate-900 dark:text-slate-100 font-semibold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                                    >
                                        Vorschau (Entwürfe)
                                    </button>
                                </div>
                            )}
                            {activeReport === 'ustva' && (
                                <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/20 px-3 py-1.5 rounded border border-amber-200 dark:border-amber-900/50">
                                    Basis: Nur festgeschrieben (posted) zulässig
                                </div>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-4 px-1">
                        {/* Quality indicators */}
                        {renderQualitySection()}

                        {isLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                            </div>
                        ) : (
                            renderReportContent()
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700 mt-auto">
                        <Button
                            variant="outline"
                            onClick={() => window.print()}
                            className="shadow-sm hover:shadow-md transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-600"
                        >
                            <Printer className="w-4 h-4 mr-2" />
                            Drucken
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => handleDownloadReport('csv')}
                            disabled={(activeReport === 'ustva' && hasBlockingErrors) || (activeReport === 'account-movements' && !selectedMovementAccountId)}
                            className={`shadow-sm hover:shadow-md transition-all duration-300 ${((activeReport === 'ustva' && hasBlockingErrors) || (activeReport === 'account-movements' && !selectedMovementAccountId)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={activeReport === 'ustva' && hasBlockingErrors ? 'Übertragungsbogen gesperrt wegen blockierender Fehler' : activeReport === 'account-movements' && !selectedMovementAccountId ? 'Bitte wählen Sie ein Konto' : ''}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            {activeReport === 'ustva' ? 'Übertragungsbogen (CSV)' : 'CSV'}
                        </Button>
                        <Button
                            onClick={() => handleDownloadReport('pdf')}
                            disabled={(activeReport === 'ustva' && hasBlockingErrors) || (activeReport === 'account-movements' && !selectedMovementAccountId)}
                            className={`shadow-lg transition-all duration-300 ${
                                ((activeReport === 'ustva' && hasBlockingErrors) || (activeReport === 'account-movements' && !selectedMovementAccountId))
                                    ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-none cursor-not-allowed opacity-50'
                                    : 'shadow-blue-500/20 hover:shadow-blue-500/30 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 font-semibold'
                            }`}
                            title={activeReport === 'ustva' && hasBlockingErrors ? 'Übertragungsbogen gesperrt wegen blockierender Fehler' : activeReport === 'account-movements' && !selectedMovementAccountId ? 'Bitte wählen Sie ein Konto' : ''}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            {activeReport === 'ustva' ? 'Übertragungsbogen (PDF)' : 'PDF'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setActiveReport(null)}
                            className="shadow-sm hover:shadow-md transition-all duration-300"
                        >
                            Schließen
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Mappings Editor Dialog */}
            <Dialog open={mappingEditorOpen} onOpenChange={(open) => !open && setMappingEditorOpen(false)}>
                <DialogContent className="max-w-[80vw] h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <span>Bericht-Kontenzuordnung verwalten</span>
                            <Badge variant="outline" className="text-xs">{mappingReportType.toUpperCase()}</Badge>
                        </DialogTitle>
                        <DialogDescription>
                            Ordne aktive Sachkonten den verschiedenen Zeilen der BWA oder den USt-VA-Kennziffern zu.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Report Type Selector */}
                    <div className="flex gap-2 border-b pb-4">
                        <Button
                            variant={mappingReportType === 'bwa' ? 'default' : 'outline'}
                            onClick={() => { setMappingReportType('bwa'); loadMappings('bwa'); }}
                            className="text-xs"
                        >
                            BWA Mappings
                        </Button>
                        <Button
                            variant={mappingReportType === 'ustva' ? 'default' : 'outline'}
                            onClick={() => { setMappingReportType('ustva'); loadMappings('ustva'); }}
                            className="text-xs"
                        >
                            USt-VA Mappings
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto py-4 space-y-4">
                        {/* New Mapping Form */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
                            <h4 className="font-semibold text-sm">Neue Zuordnung hinzufügen</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Left column: Search and Select Account */}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">1. Konto suchen & auswählen</label>
                                    <input 
                                        type="text"
                                        placeholder="Konto filtern nach Nummer oder Name..."
                                        value={mappingAccountSearchQuery}
                                        onChange={(e) => setMappingAccountSearchQuery(e.target.value)}
                                        className="w-full text-xs p-2 rounded border bg-background border-slate-300 dark:border-slate-700 h-9 mb-1"
                                    />
                                    <div className="border rounded-md max-h-40 overflow-y-auto bg-white dark:bg-slate-950 divide-y shadow-inner">
                                        {filteredMappingAccounts.map(acc => (
                                            <button
                                                key={acc.public_id}
                                                type="button"
                                                onClick={() => setSelectedAccountPublicId(acc.public_id)}
                                                className={`w-full text-left p-2 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-xs flex justify-between items-center ${
                                                    selectedAccountPublicId === acc.public_id 
                                                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold' 
                                                        : 'text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                <span>{acc.code} - {acc.name}</span>
                                                {selectedAccountPublicId === acc.public_id && <Check className="w-3.5 h-3.5 text-blue-500" />}
                                            </button>
                                        ))}
                                        {filteredMappingAccounts.length === 0 && (
                                            <div className="p-3 text-slate-500 text-center text-xs">
                                                Keine Konten gefunden
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right column: Target settings and Action */}
                                <div className="space-y-3 flex flex-col justify-between">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-500">Ziel-Kategorie</label>
                                            <select
                                                value={selectedTargetCode}
                                                onChange={(e) => setSelectedTargetCode(e.target.value)}
                                                className="w-full text-xs p-2 rounded border bg-background border-slate-300 dark:border-slate-700 h-9"
                                            >
                                                {mappingData && Object.entries(mappingData.target_codes).map(([code, def]: any) => (
                                                    <option key={code} value={code}>
                                                        {code} ({def.label})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-500">Werttyp</label>
                                            <select
                                                value={selectedValueType}
                                                onChange={(e) => setSelectedValueType(e.target.value)}
                                                className="w-full text-xs p-2 rounded border bg-background border-slate-300 dark:border-slate-700 h-9"
                                            >
                                                {mappingReportType === 'ustva' ? (
                                                    <>
                                                        <option value="base_amount">Bemessungsgrundlage (base_amount)</option>
                                                        <option value="tax_amount">Steuerbetrag (tax_amount)</option>
                                                    </>
                                                ) : (
                                                    <>
                                                        <option value="balance">Saldo (balance)</option>
                                                        <option value="debit">Soll (debit)</option>
                                                        <option value="credit">Haben (credit)</option>
                                                    </>
                                                )}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-500">Vorzeichen</label>
                                            <select
                                                value={selectedSign}
                                                onChange={(e) => setSelectedSign(Number(e.target.value))}
                                                className="w-full text-xs p-2 rounded border bg-background border-slate-300 dark:border-slate-700 h-9"
                                            >
                                                <option value={1}>Normal (+1)</option>
                                                <option value={-1}>Invertiert (-1)</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-end pt-2">
                                        <Button
                                            onClick={handleAddMappingLocal}
                                            type="button"
                                            disabled={!selectedAccountPublicId}
                                            className={`flex justify-center items-center gap-1 text-xs h-9 font-semibold px-4 ${
                                                !selectedAccountPublicId
                                                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                                    : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900'
                                            }`}
                                        >
                                            <Plus className="w-4 h-4" /> Zuordnung hinzufügen
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* List of current mappings */}
                        <div className="border rounded-md overflow-hidden max-h-[35vh] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                                    <TableRow className="h-9">
                                        <TableHead className="text-xs h-9">Konto</TableHead>
                                        <TableHead className="text-xs h-9">Ziel-Kategorie</TableHead>
                                        <TableHead className="text-xs h-9">Werttyp</TableHead>
                                        <TableHead className="text-xs h-9">Vorzeichen</TableHead>
                                        <TableHead className="text-right text-xs h-9 pr-6">Aktion</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mappingData?.mappings?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-slate-500 py-6 text-sm">
                                                Keine Zuordnungen definiert. Nutze das Formular oben, um Zuordnungen hinzuzufügen.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        mappingData?.mappings?.map((mapping: any, idx: number) => (
                                            <TableRow key={mapping.public_id || idx} className="h-9 hover:bg-slate-50/50">
                                                <TableCell className="font-mono text-xs py-1">
                                                    {mapping.source?.code} - {mapping.source?.name}
                                                </TableCell>
                                                <TableCell className="py-1">
                                                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                                        {mapping.target_code}
                                                    </span>
                                                    {" "}
                                                    <span className="text-xs text-muted-foreground">
                                                        ({mappingData.target_codes[mapping.target_code]?.label})
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs py-1 text-slate-500">
                                                    {mapping.value_type}
                                                </TableCell>
                                                <TableCell className="py-1 font-mono text-xs font-semibold">
                                                    {mapping.sign === 1 ? '+' : '-'}
                                                </TableCell>
                                                <TableCell className="text-right py-1 pr-4">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveMappingLocal(idx)}
                                                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 h-7 w-7 p-0"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 mt-auto">
                        <Button
                            variant="outline"
                            onClick={() => setMappingEditorOpen(false)}
                            className="shadow-sm hover:shadow-md transition-all duration-300"
                        >
                            Abbrechen
                        </Button>
                        <Button
                            onClick={handleSaveMappings}
                            disabled={isSavingMappings}
                            className="shadow-lg shadow-blue-500/20 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 font-semibold"
                        >
                            {isSavingMappings ? 'Wird gespeichert...' : 'Zuordnungen speichern'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
