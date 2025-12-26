import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { format } from 'date-fns';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { startOfMonth, endOfMonth, startOfYear } from 'date-fns';

export function AccountDetail() {
    const { tenant, id } = useParams();
    const navigate = useNavigate();

    const [fromDate, setFromDate] = useState<string>(format(startOfYear(new Date()), 'yyyy-MM-dd'));
    const [toDate, setToDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    const { data, isLoading } = useQuery({
        queryKey: ['account-detail', id, fromDate, toDate],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (fromDate) params.append('from_date', fromDate);
            if (toDate) params.append('to_date', toDate);

            const { data } = await axios.get(`/api/accounts/${id}?${params.toString()}`);
            return data;
        },
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount / 100);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Konto nicht gefunden</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/${tenant}/accounts`)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {data.account.code} - {data.account.name}
                        </h1>
                        <p className="text-muted-foreground">
                            Kontoart: {data.account.type}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.print()}>
                        <Printer className="w-4 h-4 mr-2" />
                        Drucken
                    </Button>
                    <Button variant="default">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-end gap-4 bg-card p-4 rounded-lg border">
                <div className="flex-1">
                    <Label htmlFor="from-date" className="text-sm font-medium mb-1.5 block">
                        Von
                    </Label>
                    <Input
                        id="from-date"
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full"
                    />
                </div>
                <div className="flex-1">
                    <Label htmlFor="to-date" className="text-sm font-medium mb-1.5 block">
                        Bis
                    </Label>
                    <Input
                        id="to-date"
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full"
                    />
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setFromDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                            setToDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                        }}
                    >
                        Dieser Monat
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setFromDate(format(startOfYear(new Date()), 'yyyy-MM-dd'));
                            setToDate(format(new Date(), 'yyyy-MM-dd'));
                        }}
                    >
                        Dieses Jahr
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="bg-card p-6 rounded-lg border">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Soll (Eingang)</div>
                    <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(data.summary.total_debit)}
                    </div>
                </div>
                <div className="bg-card p-6 rounded-lg border">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Haben (Ausgang)</div>
                    <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(data.summary.total_credit)}
                    </div>
                </div>
                <div className="bg-card p-6 rounded-lg border">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Aktueller Saldo</div>
                    <div className={`text-2xl font-bold ${data.summary.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(data.summary.current_balance)}
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-card rounded-lg border">
                <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">Kontobewegungen</h2>
                    <p className="text-sm text-muted-foreground">
                        {data.transactions.length} Buchungen
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Datum</TableHead>
                                <TableHead>Beschreibung</TableHead>
                                <TableHead>Beleg</TableHead>
                                <TableHead>Kontakt</TableHead>
                                <TableHead className="text-right">Soll (Ein)</TableHead>
                                <TableHead className="text-right">Haben (Aus)</TableHead>
                                <TableHead className="text-right">Saldo</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                        Keine Buchungen im ausgewählten Zeitraum
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.transactions.map((transaction: any) => (
                                    <TableRow key={transaction.id}>
                                        <TableCell className="font-mono text-sm">
                                            {format(new Date(transaction.date), 'dd.MM.yyyy')}
                                        </TableCell>
                                        <TableCell>{transaction.description}</TableCell>
                                        <TableCell className="font-mono text-sm">
                                            {transaction.reference || '-'}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {transaction.contact || '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-green-600">
                                            {transaction.debit > 0 ? formatCurrency(transaction.debit) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-red-600">
                                            {transaction.credit > 0 ? formatCurrency(transaction.credit) : '-'}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono font-semibold ${transaction.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(transaction.balance)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
