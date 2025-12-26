import { useState } from 'react';
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

type ReportType = 'trial-balance' | 'profit-loss' | 'balance-sheet' | 'journal-export' | 'account-movements' | 'tax-report';

export function Reports() {
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
        from: new Date(),
        to: new Date()
    });
    const [activeReport, setActiveReport] = useState<ReportType | null>(null);
    const [reportData, setReportData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateReport = async (type: ReportType) => {
        setIsLoading(true);
        setActiveReport(type);
        setReportData(null);

        try {
            const queryParams = new URLSearchParams({
                from_date: format(dateRange.from, 'yyyy-MM-dd'),
                to_date: format(dateRange.to, 'yyyy-MM-dd'),
            });

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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount / 100);
    };

    const renderReportContent = () => {
        if (!reportData) return null;

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
            case 'tax-report': return 'USt-Voranmeldung';
            default: return 'Bericht';
        }
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Journal & Berichte</h1>
                    <p className="text-slate-500 dark:text-slate-400">Finanzberichte und Auswertungen erstellen</p>
                </div>
                <DateRangeSelector onRangeChange={(from, to) => setDateRange({ from, to })} />
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
                    onClick={() => alert('Bitte wählen Sie ein Konto aus der Kontenliste, um Bewegungen zu sehen.')}
                />
                <ReportCard
                    title="USt-Voranmeldung"
                    description="Zusammenstellung der Umsatzsteuer-Zahllast für das Finanzamt."
                    icon={Receipt}
                    color="text-rose-600"
                    onClick={() => handleGenerateReport('tax-report')}
                />
            </div>

            {/* Report Dialog */}
            <Dialog open={!!activeReport} onOpenChange={(open) => !open && setActiveReport(null)}>
                <DialogContent className="max-w-[90vw] h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl">
                            {activeReport && getReportTitle(activeReport)}
                            <span className="text-sm font-normal text-slate-500 ml-4">
                                {format(dateRange.from, 'dd.MM.yyyy')} - {format(dateRange.to, 'dd.MM.yyyy')}
                            </span>
                        </DialogTitle>
                        <DialogDescription>
                            Vorschau des Berichts. Nutzen Sie die Export-Funktionen für die Weiterverarbeitung.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-1">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
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
                            className="shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            PDF Export
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
        </div>
    );
}
