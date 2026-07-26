import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { TrendingUp, TrendingDown, Wallet, Target, Download } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuditTrail } from '@/components/AuditTrail';
import { formatCurrency } from '@/lib/currency';

interface Summary {
    revenue: number; cost: number; profit: number;
    budget_amount: number | null; budget_used_pct: number | null;
    cost_by_account: { account_code: string; account_name: string; amount: number }[];
    monthly: { month: string; revenue: number; cost: number }[];
}
interface CostLine { booking_date: string; document_number: string | null; description: string; netto: number; ust: number; brutto: number; status: string; }
interface CostReport { lines: CostLine[]; totals: { netto: number; ust: number; brutto: number }; }

function KpiCard({ icon: Icon, label, value, hint, tone }: { icon: any; label: string; value: string; hint?: string; tone: string }) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <Icon className={`h-4 w-4 ${tone}`} />
                </div>
                <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
                {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
            </CardContent>
        </Card>
    );
}

interface DimensionDashboardProps {
    /** API-Basis, z.B. `/api/projects/3` oder `/api/cost-centers/2` */
    basePath: string;
    queryKey: string;
    showBudget?: boolean;
    /** Kosten-Nachweis-PDF anbieten (nur Projekte) */
    pdfName?: string;
    /** Verlauf-Tab (nur Projekte – 'project') */
    auditableType?: string;
    auditableId?: number;
}

export function DimensionDashboard({ basePath, queryKey, showBudget, pdfName, auditableType, auditableId }: DimensionDashboardProps) {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const { data: summary } = useQuery<Summary>({
        queryKey: ['dim-summary', queryKey],
        queryFn: async () => (await axios.get(`${basePath}/summary`)).data,
    });
    const { data: costReport } = useQuery<CostReport>({
        queryKey: ['dim-cost-report', queryKey, from, to],
        queryFn: async () => (await axios.get(`${basePath}/cost-report`, {
            params: { from: from || undefined, to: to || undefined },
        })).data,
    });

    const monthlyData = (summary?.monthly ?? []).map((m) => ({
        month: m.month, Umsatz: m.revenue / 100, Kosten: m.cost / 100,
    }));

    const downloadPdf = () => {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const token = localStorage.getItem('auth_token');
        fetch(`${basePath}/cost-report/pdf?${params}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(async (r) => {
                if (!r.ok) { alert('PDF konnte nicht erstellt werden.'); return; }
                const blob = await r.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = pdfName ?? 'Kosten-Nachweis.pdf'; a.click();
                URL.revokeObjectURL(url);
            });
    };

    return (
        <div className="space-y-4">
            {/* KPI-Kacheln */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <KpiCard icon={TrendingUp} label="Umsatz" tone="text-emerald-600 dark:text-emerald-400"
                    value={formatCurrency((summary?.revenue ?? 0) / 100)} />
                <KpiCard icon={TrendingDown} label="Kosten" tone="text-red-600 dark:text-red-400"
                    value={formatCurrency((summary?.cost ?? 0) / 100)} />
                <KpiCard icon={Wallet} label="Gewinn"
                    tone={(summary?.profit ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
                    value={formatCurrency((summary?.profit ?? 0) / 100)} />
                {showBudget && (
                    <KpiCard icon={Target} label="Budget" tone="text-blue-600 dark:text-blue-400"
                        value={summary?.budget_amount != null ? formatCurrency(summary.budget_amount / 100) : '–'}
                        hint={summary?.budget_used_pct != null ? `${summary.budget_used_pct}% genutzt` : undefined} />
                )}
            </div>

            {/* Budget-Fortschritt */}
            {showBudget && summary?.budget_amount != null && summary.budget_amount > 0 && (
                <Card><CardContent className="p-4">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Budget-Auslastung</span>
                        <span className="font-medium">{formatCurrency((summary.cost) / 100)} / {formatCurrency(summary.budget_amount / 100)}</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${(summary.budget_used_pct ?? 0) > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(summary.budget_used_pct ?? 0, 100)}%` }} />
                    </div>
                </CardContent></Card>
            )}

            <Tabs defaultValue="reports">
                <TabsList>
                    <TabsTrigger value="reports">Berichte</TabsTrigger>
                    <TabsTrigger value="cost-report">Kosten-Nachweis</TabsTrigger>
                    {auditableType && <TabsTrigger value="history">Verlauf</TabsTrigger>}
                </TabsList>

                <TabsContent value="reports" className="space-y-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">Umsatz & Kosten je Monat</CardTitle></CardHeader>
                        <CardContent>
                            {monthlyData.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">Noch keine festgeschriebenen Buchungen.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={monthlyData}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                        <XAxis dataKey="month" fontSize={12} />
                                        <YAxis fontSize={12} />
                                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                                        <Legend />
                                        <Bar dataKey="Umsatz" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Kosten" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">Kosten je Konto</CardTitle></CardHeader>
                        <CardContent>
                            {(summary?.cost_by_account ?? []).length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">Keine Kosten erfasst.</p>
                            ) : (
                                <div className="divide-y">
                                    {(summary?.cost_by_account ?? []).map((row) => (
                                        <div key={row.account_code} className="flex items-center justify-between py-2 text-sm">
                                            <span><span className="font-mono text-xs text-muted-foreground mr-2">{row.account_code}</span>{row.account_name}</span>
                                            <span className="font-medium">{formatCurrency(row.amount / 100)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="cost-report" className="space-y-3">
                    <Card>
                        <CardHeader className="pb-3"><CardTitle className="text-base">Kosten-Nachweis</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex flex-wrap items-end gap-3">
                                <div><label className="text-xs text-muted-foreground block mb-1">Von</label>
                                    <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                                <div><label className="text-xs text-muted-foreground block mb-1">Bis</label>
                                    <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
                                {pdfName && <Button variant="outline" onClick={downloadPdf}><Download className="h-4 w-4 mr-1" /> PDF</Button>}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b text-left text-muted-foreground">
                                        <th className="p-2">Datum</th><th className="p-2">Beleg</th><th className="p-2">Beschreibung</th>
                                        <th className="p-2 text-right">Netto</th><th className="p-2 text-right">USt</th><th className="p-2 text-right">Brutto</th>
                                    </tr></thead>
                                    <tbody>
                                        {(costReport?.lines ?? []).length === 0 ? (
                                            <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Keine Kosten im Zeitraum.</td></tr>
                                        ) : (costReport?.lines ?? []).map((l, i) => (
                                            <tr key={i} className={`border-b ${l.status === 'cancelled' ? 'text-muted-foreground line-through' : ''}`}>
                                                <td className="p-2">{l.booking_date}</td>
                                                <td className="p-2">{l.document_number ?? '–'}</td>
                                                <td className="p-2">{l.description}</td>
                                                <td className="p-2 text-right">{formatCurrency(l.netto / 100)}</td>
                                                <td className="p-2 text-right">{formatCurrency(l.ust / 100)}</td>
                                                <td className="p-2 text-right">{formatCurrency(l.brutto / 100)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot><tr className="border-t-2 font-bold">
                                        <td className="p-2" colSpan={3}>Summe</td>
                                        <td className="p-2 text-right">{formatCurrency((costReport?.totals.netto ?? 0) / 100)}</td>
                                        <td className="p-2 text-right">{formatCurrency((costReport?.totals.ust ?? 0) / 100)}</td>
                                        <td className="p-2 text-right">{formatCurrency((costReport?.totals.brutto ?? 0) / 100)}</td>
                                    </tr></tfoot>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {auditableType && (
                    <TabsContent value="history">
                        <AuditTrail auditableType={auditableType} auditableId={auditableId} title="Verlauf" />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
