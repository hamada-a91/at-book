import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from '@/lib/axios';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus, FileText, Trash2, Send, Euro, Eye, Edit, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Invoice {
    id: number;
    invoice_number: string;
    contact: {
        id: number;
        name: string;
    };
    invoice_date: string;
    due_date: string;
    status: string;
    total: number;
}

export function InvoicesList() {
    const navigate = useNavigate();
    const { tenant } = useParams();
    const queryClient = useQueryClient();
    const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; invoice: Invoice | null }>({ open: false, invoice: null });
    const [paymentAccount, setPaymentAccount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');

    const { data: invoices, isLoading } = useQuery<Invoice[]>({
        queryKey: ['invoices'],
        queryFn: async () => {
            const { data } = await axios.get('/api/invoices');
            return data;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const { data } = await axios.delete(`/api/invoices/${id}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
    });

    const bookMutation = useMutation({
        mutationFn: async (id: number) => {
            const { data } = await axios.post(`/api/invoices/${id}/book`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
    });

    // Get accounts for payment (Kasse/Bank)
    const { data: accounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/accounts');
            return data;
        },
    });

    const paymentMutation = useMutation({
        mutationFn: async ({ invoiceId, data }: { invoiceId: number; data: any }) => {
            const { data: resData } = await axios.post(`/api/invoices/${invoiceId}/payment`, data);
            return resData;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            setPaymentDialog({ open: false, invoice: null });
            setPaymentAccount('');
        },
    });

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
        }).format(cents / 100);
    };

    const statusStyles: Record<string, string> = {
        draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        booked: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        sent: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
        paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    };

    const statusLabels: Record<string, string> = {
        draft: 'Entwurf',
        booked: 'Gebucht',
        sent: 'Versendet',
        paid: 'Bezahlt',
        cancelled: 'Storniert',
    };

    const cashAndBankAccounts = accounts?.filter((a: any) => a.type === 'asset' && (a.code.startsWith('10') || a.code.startsWith('12'))) || [];

    const handlePayment = () => {
        if (!paymentDialog.invoice || !paymentAccount) return;

        paymentMutation.mutate({
            invoiceId: paymentDialog.invoice.id,
            data: {
                payment_account_id: parseInt(paymentAccount),
                payment_date: paymentDate,
            },
        });
    };

    const handleDelete = (id: number) => {
        if (confirm('Rechnung wirklich löschen?')) {
            deleteMutation.mutate(id);
        }
    };

    const handleBook = (id: number) => {
        if (confirm('Rechnung jetzt buchen? Dies kann nicht rückgängig gemacht werden.')) {
            bookMutation.mutate(id);
        }
    };

    const filteredInvoices = invoices?.filter(invoice =>
        invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.contact.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Rechnungen</h1>
                    <p className="text-slate-500 dark:text-slate-400">Verwalten Sie Ihre Ausgangsrechnungen</p>
                </div>
                <Link to={`/${tenant}/invoices/create`}>
                    <Button className="shadow-lg shadow-blue-100/20 hover:shadow-blue-200/30 transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Neue Rechnung
                    </Button>
                </Link>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Suchen nach Nummer oder Kunde..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                </div>
                {/* Future: Add more filters here */}
            </div>

            {/* Invoice List */}
            <Card className="w-full shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                {isLoading ? (
                    <CardContent className="p-12 flex justify-center">
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800 rounded-full mb-4"></div>
                            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
                        </div>
                    </CardContent>
                ) : filteredInvoices && filteredInvoices.length === 0 ? (
                    <CardContent className="p-12 text-center text-slate-500 dark:text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">Keine Rechnungen gefunden</h3>
                        <p className="mb-6">Erstellen Sie Ihre erste Rechnung, um loszulegen.</p>
                        <Link to={`/${tenant}/invoices/create`}>
                            <Button variant="link" className="text-blue-600 hover:text-blue-800 p-0 h-auto font-normal">
                                Jetzt eine erstellen
                            </Button>
                        </Link>
                    </CardContent>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Nr.
                                    </th>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Kunde
                                    </th>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Datum
                                    </th>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Fällig
                                    </th>
                                    <th className="px-6 py-4 text-right font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Betrag
                                    </th>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-right font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Aktionen
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredInvoices?.map((invoice) => (
                                    <tr key={invoice.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                                            {invoice.invoice_number}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900 dark:text-slate-100">{invoice.contact.name}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            {new Date(invoice.invoice_date).toLocaleDateString('de-DE')}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            {new Date(invoice.due_date).toLocaleDateString('de-DE')}
                                        </td>
                                        <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                                            {formatCurrency(invoice.total)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className={`font-normal ${statusStyles[invoice.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                {statusLabels[invoice.status] || invoice.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* View Button - Always */}
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                    onClick={() => navigate(`/${tenant}/invoices/${invoice.id}/preview`)}
                                                    title="Ansehen"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>

                                                {invoice.status === 'draft' && (
                                                    <>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                            onClick={() => handleBook(invoice.id)}
                                                            disabled={bookMutation.isPending}
                                                            title="Buchen"
                                                        >
                                                            <Send className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                                            onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
                                                            title="Bearbeiten"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                                            onClick={() => handleDelete(invoice.id)}
                                                            disabled={deleteMutation.isPending}
                                                            title="Löschen"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </>
                                                )}
                                                {(invoice.status === 'booked' || invoice.status === 'sent') && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                                        onClick={() => setPaymentDialog({ open: true, invoice })}
                                                    >
                                                        <Euro className="w-4 h-4 mr-1" />
                                                        <span className="text-xs font-medium">Zahlung</span>
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Payment Dialog */}
            <Dialog open={paymentDialog.open} onOpenChange={(open) => !open && setPaymentDialog({ open: false, invoice: null })}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Zahlung erfassen</DialogTitle>
                        <DialogDescription>
                            Verbuchen Sie einen Zahlungseingang für diese Rechnung.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Rechnung:</span>
                                <span className="font-mono font-medium">{paymentDialog.invoice?.invoice_number}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Offener Betrag:</span>
                                <span className="font-bold text-slate-900 dark:text-slate-100">{paymentDialog.invoice && formatCurrency(paymentDialog.invoice.total)}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Zahlungseingang auf Konto *
                            </label>
                            <Select value={paymentAccount} onValueChange={setPaymentAccount}>
                                <SelectTrigger className="bg-white dark:bg-slate-950">
                                    <SelectValue placeholder="Konto auswählen..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {cashAndBankAccounts.map((account: any) => (
                                        <SelectItem key={account.id} value={account.id.toString()}>
                                            <span className="font-mono text-slate-500 mr-2">{account.code}</span>
                                            {account.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Zahlungsdatum *
                            </label>
                            <Input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="bg-white dark:bg-slate-950"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPaymentDialog({ open: false, invoice: null })}>
                            Abbrechen
                        </Button>
                        <Button onClick={handlePayment} disabled={!paymentAccount || paymentMutation.isPending}>
                            {paymentMutation.isPending ? 'Erfasse...' : 'Zahlung buchen'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
