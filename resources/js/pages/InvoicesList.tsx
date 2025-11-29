import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Navigation } from '@/components/Layout/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Trash2, Send } from 'lucide-react';

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
    const queryClient = useQueryClient();

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
                                                    {invoice.status === 'draft' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => bookMutation.mutate(invoice.id)}
                                                                disabled={bookMutation.isPending}
                                                            >
                                                                <Send className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    if (confirm('Rechnung wirklich löschen?')) {
                                                                        deleteMutation.mutate(invoice.id);
                                                                    }
                                                                }}
                                                                disabled={deleteMutation.isPending}
                                                            >
                                                                <Trash2 className="w-4 h-4 text-red-600" />
                                                            </Button>
                                                        </>
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
            </div>
        </Navigation>
    );
}
