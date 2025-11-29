import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Layout/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, FileText, Trash2, Send, Euro, Eye, Edit } from 'lucide-react';

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
    const queryClient = useQueryClient();
    const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; invoice: Invoice | null }>({ open: false, invoice: null });
    const [paymentAccount, setPaymentAccount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    const { data: invoices, isLoading } = useQuery<Invoice[]>({
        queryKey: ['invoices'],
        queryFn: async () => {
            const res = await fetch('/api/invoices');
            return res.json();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Fehler beim Löschen');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
    });

    const bookMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/invoices/${id}/book`, { method: 'POST' });
            if (!res.ok) throw new Error('Fehler beim Buchen');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
    });

    // Get accounts for payment (Kasse/Bank)
    const { data: accounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => {
            const res = await fetch('/api/accounts');
            return res.json();
        },
    });

    const paymentMutation = useMutation({
        mutationFn: async ({ invoiceId, data }: { invoiceId: number; data: any }) => {
            const res = await fetch(`/api/invoices/${invoiceId}/payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Fehler beim Erfassen der Zahlung');
            return res.json();
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

    const statusColors: Record<string, string> = {
        draft: 'bg-yellow-100 text-yellow-700',
        booked: 'bg-blue-100 text-blue-700',
        sent: 'bg-purple-100 text-purple-700',
        paid: 'bg-green-100 text-green-700',
        cancelled: 'bg-red-100 text-red-700',
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

    return (
        <Navigation>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-900">Rechnungen</h1>
                        <p className="text-slate-600">Verwalte deine Ausgangsrechnungen</p>
                    </div>
                    <Link to="/invoices/create">
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            Neue Rechnung
                        </Button>
                    </Link>
                </div>

                {/* Invoice List */}
                <Card className="shadow-lg">
                    {isLoading ? (
                        <CardContent className="p-8 text-center">Lade Rechnungen...</CardContent>
                    ) : invoices && invoices.length === 0 ? (
                        <CardContent className="p-8 text-center text-slate-500">
                            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                            <p className="mb-4">Noch keine Rechnungen vorhanden</p>
                            <Link to="/invoices/create">
                                <Button>Erste Rechnung erstellen</Button>
                            </Link>
                        </CardContent>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-100 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                                            Rechnungsnr.
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                                            Kunde
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                                            Datum
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                                            Fällig
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase">
                                            Betrag
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase">
                                            Aktionen
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {invoices?.map((invoice) => (
                                        <tr key={invoice.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-mono font-medium">
                                                {invoice.invoice_number}
                                            </td>
                                            <td className="px-6 py-4">{invoice.contact.name}</td>
                                            <td className="px-6 py-4">
                                                {new Date(invoice.invoice_date).toLocaleDateString('de-DE')}
                                            </td>
                                            <td className="px-6 py-4">
                                                {new Date(invoice.due_date).toLocaleDateString('de-DE')}
                                            </td>
                                            <td className="px-6 py-4 text-right font-semibold">
                                                {formatCurrency(invoice.total)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[invoice.status] || 'bg-gray-100 text-gray-700'
                                                        }`}
                                                >
                                                    {statusLabels[invoice.status] || invoice.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {/* View Button - Always */}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => navigate(`/invoices/${invoice.id}/preview`)}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>

                                                    {invoice.status === 'draft' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleBook(invoice.id)}
                                                                disabled={bookMutation.isPending}
                                                            >
                                                                <Send className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDelete(invoice.id)}
                                                                disabled={deleteMutation.isPending}
                                                            >
                                                                <Trash2 className="w-4 h-4 text-red-600" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {(invoice.status === 'booked' || invoice.status === 'sent') && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-1"
                                                            onClick={() => setPaymentDialog({ open: true, invoice })}
                                                        >
                                                            <Euro className="w-4 h-4" />
                                                            Zahlung
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
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Zahlung erfassen</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <p className="text-sm text-slate-600 mb-2">
                                    Rechnung: <span className="font-mono font-semibold">{paymentDialog.invoice?.invoice_number}</span>
                                </p>
                                <p className="text-sm text-slate-600">
                                    Betrag: <span className="font-semibold">{paymentDialog.invoice && formatCurrency(paymentDialog.invoice.total)}</span>
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Zahlungseingang auf Konto *
                                </label>
                                <Select value={paymentAccount} onValueChange={setPaymentAccount}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Konto auswählen..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {cashAndBankAccounts.map((account: any) => (
                                            <SelectItem key={account.id} value={account.id.toString()}>
                                                {account.code} - {account.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Zahlungsdatum *
                                </label>
                                <Input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setPaymentDialog({ open: false, invoice: null })}>
                                Abbrechen
                            </Button>
                            <Button onClick={handlePayment} disabled={!paymentAccount || paymentMutation.isPending}>
                                {paymentMutation.isPending ? 'Erfasse...' : 'Zahlung erfassen'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </Navigation>
    );
}
