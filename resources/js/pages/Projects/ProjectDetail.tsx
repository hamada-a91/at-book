import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import axios from '@/lib/axios';
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, Target, Download, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuditTrail } from '@/components/AuditTrail';
import { formatCurrency } from '@/lib/currency';

interface Summary {
    project_number: string; project_name: string;
    revenue: number; cost: number; profit: number;
    budget_amount: number | null; budget_used_pct: number | null; open_belege_count: number;
}
interface Project { id: number; number: string; name: string; status: string; contact?: { name: string } | null; }
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

export function ProjectDetail() {
    const { tenant, id } = useParams<{ tenant: string; id: string }>();
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const { data: project } = useQuery<Project>({
        queryKey: ['project', id],
        queryFn: async () => (await axios.get(`/api/projects/${id}`)).data,
    });
    const { data: summary } = useQuery<Summary>({
        queryKey: ['project-summary', id],
        queryFn: async () => (await axios.get(`/api/projects/${id}/summary`)).data,
    });
    const { data: entries } = useQuery<any[]>({
        queryKey: ['project-entries', id],
        queryFn: async () => (await axios.get(`/api/projects/${id}/entries`)).data,
    });
    const { data: costReport } = useQuery<CostReport>({
        queryKey: ['project-cost-report', id, from, to],
        queryFn: async () => (await axios.get(`/api/projects/${id}/cost-report`, {
            params: { from: from || undefined, to: to || undefined },
        })).data,
    });

    const downloadPdf = () => {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const token = localStorage.getItem('auth_token');
        // Über fetch mit Auth-Header, dann Blob-Download (Bearer-Auth nötig)
        fetch(`/api/projects/${id}/cost-report/pdf?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then(async (r) => {
            if (!r.ok) { alert('PDF konnte nicht erstellt werden.'); return; }
            const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Kosten-Nachweis-${project?.number ?? id}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        });
    };

    return (
        <div className="space-y-4">
            <Link to={`/${tenant}/projects`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Zurück zu Projekten
            </Link>

            <div className="flex items-center gap-3">
                <div>
                    <div className="text-xs font-mono text-muted-foreground">{project?.number}</div>
                    <h1 className="text-2xl font-bold">{project?.name}</h1>
                </div>
                {project?.contact
                    ? <Badge variant="secondary">{project.contact.name}</Badge>
                    : <Badge variant="secondary">Internes Projekt</Badge>}
            </div>

            {/* KPI-Kacheln */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <KpiCard icon={TrendingUp} label="Umsatz" tone="text-emerald-600 dark:text-emerald-400"
                    value={formatCurrency((summary?.revenue ?? 0) / 100)} />
                <KpiCard icon={TrendingDown} label="Kosten" tone="text-red-600 dark:text-red-400"
                    value={formatCurrency((summary?.cost ?? 0) / 100)} />
                <KpiCard icon={Wallet} label="Gewinn" tone={(summary?.profit ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
                    value={formatCurrency((summary?.profit ?? 0) / 100)} />
                <KpiCard icon={Target} label="Budget" tone="text-blue-600 dark:text-blue-400"
                    value={summary?.budget_amount != null ? formatCurrency(summary.budget_amount / 100) : '–'}
                    hint={summary?.budget_used_pct != null ? `${summary.budget_used_pct}% genutzt` : undefined} />
            </div>

            <Tabs defaultValue="bookings">
                <TabsList>
                    <TabsTrigger value="bookings">Buchungen</TabsTrigger>
                    <TabsTrigger value="cost-report">Kosten-Nachweis</TabsTrigger>
                    <TabsTrigger value="history">Verlauf</TabsTrigger>
                </TabsList>

                <TabsContent value="bookings">
                    <Card><CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="border-b text-left text-muted-foreground">
                                    <th className="p-3">Datum</th><th className="p-3">Nr.</th><th className="p-3">Beschreibung</th>
                                </tr></thead>
                                <tbody>
                                    {(entries ?? []).length === 0 ? (
                                        <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Keine Buchungen.</td></tr>
                                    ) : (entries ?? []).map((e: any, i: number) => (
                                        <tr key={i} className="border-b">
                                            <td className="p-3">{e.booking_date}</td>
                                            <td className="p-3 font-mono text-xs">{e.journal_number ?? '–'}</td>
                                            <td className="p-3">{e.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent></Card>
                </TabsContent>

                <TabsContent value="cost-report" className="space-y-3">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Kosten-Nachweis (für den Kunden)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex flex-wrap items-end gap-3">
                                <div><label className="text-xs text-muted-foreground block mb-1">Von</label>
                                    <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                                <div><label className="text-xs text-muted-foreground block mb-1">Bis</label>
                                    <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
                                <Button variant="outline" onClick={downloadPdf}><Download className="h-4 w-4 mr-1" /> PDF</Button>
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

                <TabsContent value="history">
                    {id && <AuditTrail auditableType="project" auditableId={Number(id)} title="Projekt-Verlauf" />}
                </TabsContent>
            </Tabs>
        </div>
    );
}
