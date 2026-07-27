import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type PeriodView = 'as_of' | 'month' | 'year';

const money = (cents: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
const currentYear = today.slice(0, 4);

export function OpenItems() {
    const navigate = useNavigate();
    const { tenant } = useParams();
    const [type, setType] = useState('all');
    const [view, setView] = useState<PeriodView>('as_of');
    const [asOf, setAsOf] = useState(today);
    const [month, setMonth] = useState(currentMonth);
    const [year, setYear] = useState(currentYear);

    const query = useQuery({
        queryKey: ['open-items', type, view, asOf, month, year],
        queryFn: async () => {
            const params = new URLSearchParams({ view });
            if (type !== 'all') params.set('type', type);

            if (view === 'month') {
                const [selectedYear, selectedMonth] = month.split('-');
                params.set('year', selectedYear);
                params.set('month', String(Number(selectedMonth)));
            } else if (view === 'year') {
                params.set('year', year);
            } else {
                params.set('as_of', asOf);
            }

            return (await axios.get(`/api/reports/open-items?${params}`)).data;
        },
    });

    const data = query.data || { items: [], totals: { debitor: 0, kreditor: 0, net: 0 } };
    const periodDescription = view === 'month'
        ? 'Alle zum Monatsende noch offenen Debitoren und Kreditoren.'
        : view === 'year'
            ? 'Alle zum Jahresende noch offenen Debitoren und Kreditoren.'
            : 'Debitoren und Kreditoren zum gewählten Stichtag.';

    const openDocument = (item: any) => {
        const path = item.document_type === 'invoice'
            ? `/invoices/${item.id}/preview`
            : `/belege/${item.id}`;

        navigate(tenant ? `/${tenant}${path}` : path);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Offene Posten</h1>
                <p className="text-slate-500">{periodDescription}</p>
            </div>

            <Card>
                <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="grid gap-2">
                        <Label>Auswertungszeitraum</Label>
                        <Select value={view} onValueChange={(value) => setView(value as PeriodView)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="as_of">Stichtag</SelectItem>
                                <SelectItem value="month">Monat</SelectItem>
                                <SelectItem value="year">Jahr</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>{view === 'month' ? 'Monat' : view === 'year' ? 'Jahr' : 'Stichtag'}</Label>
                        {view === 'month' && (
                            <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
                        )}
                        {view === 'year' && (
                            <Input
                                type="number"
                                min="2000"
                                max="2100"
                                value={year}
                                onChange={(event) => setYear(event.target.value)}
                            />
                        )}
                        {view === 'as_of' && (
                            <Input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label>Postenart</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle offenen Posten</SelectItem>
                                <SelectItem value="debitor">Debitoren</SelectItem>
                                <SelectItem value="kreditor">Kreditoren</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader><CardTitle className="text-base">Forderungen</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-emerald-600">{money(data.totals.debitor)}</CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base">Verbindlichkeiten</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-amber-600">{money(data.totals.kreditor)}</CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base">Saldo</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(data.totals.net)}</CardContent></Card>
            </div>

            <Card>
                <CardContent className="pt-6">
                    {query.isError && (
                        <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            Die offenen Posten konnten nicht geladen werden.
                        </p>
                    )}
                    <Table>
                        <TableHeader><TableRow>
                            <TableHead>Typ</TableHead><TableHead>Beleg</TableHead><TableHead>Kontakt</TableHead>
                            <TableHead>Fällig</TableHead><TableHead className="text-right">Gesamt</TableHead>
                            <TableHead className="text-right">Bezahlt</TableHead><TableHead className="text-right">Offen</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                            {data.items.map((item: any) => (
                                <TableRow
                                    key={`${item.document_type}-${item.id}`}
                                    role="link"
                                    tabIndex={0}
                                    title={`${item.number} öffnen`}
                                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    onClick={() => openDocument(item)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            openDocument(item);
                                        }
                                    }}
                                >
                                    <TableCell>{item.type === 'debitor' ? 'Debitor' : 'Kreditor'}</TableCell>
                                    <TableCell><div className="font-medium">{item.number}</div><div className="text-xs text-slate-500">{item.title}</div></TableCell>
                                    <TableCell>{item.contact_name}</TableCell>
                                    <TableCell>{item.due_date ? new Date(item.due_date).toLocaleDateString('de-DE') : '—'}</TableCell>
                                    <TableCell className="text-right">{money(item.total)}</TableCell>
                                    <TableCell className="text-right">{money(item.amount_paid)}</TableCell>
                                    <TableCell className="text-right font-semibold">{money(item.open_amount)}</TableCell>
                                </TableRow>
                            ))}
                            {!query.isLoading && !data.items.length && (
                                <TableRow><TableCell colSpan={7} className="py-10 text-center text-slate-500">Keine offenen Posten für den gewählten Zeitraum.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
