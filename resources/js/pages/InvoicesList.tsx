import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from '@/lib/axios';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Trash2, Send, Euro, Eye, Edit, Search, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SendEmailModal, EmailData } from '@/components/SendEmailModal';
import { PaymentManagement } from '@/components/PaymentManagement';

interface Invoice {
    id: number;
    invoice_number: string;
    contact: {
        id: number;
        name: string;
        email?: string;
    };
    order?: {
        id: number;
        order_number: string;
    };
    invoice_date: string;
    due_date: string;
    status: string;
    total: number;
    amount_paid: number;
    open_amount: number;
}

export function InvoicesList() {
    const navigate = useNavigate();
    const { tenant } = useParams();
    const queryClient = useQueryClient();
    const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; invoice: Invoice | null }>({ open: false, invoice: null });
    const [searchTerm, setSearchTerm] = useState('');
    const [emailModal, setEmailModal] = useState<{ open: boolean; invoice: Invoice | null }>({ open: false, invoice: null });

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

    const sendMutation = useMutation({
        mutationFn: async ({ id, emailData }: { id: number; emailData: EmailData }) => {
            const { data } = await axios.post(`/api/invoices/${id}/send`, emailData);
            return data;
        },
        onSuccess: () => {
            setEmailModal({ open: false, invoice: null });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
        },
    });

    // Fetch company settings for email signature
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data } = await axios.get('/api/settings');
            return data;
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

    const handleSend = (invoice: Invoice) => {
        setEmailModal({ open: true, invoice });
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
                        {/* Mobile List View */}
                        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredInvoices?.map((invoice) => (
                                <div
                                    key={invoice.id}
                                    className="p-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors cursor-pointer"
                                    onClick={() => navigate(`/${tenant}/invoices/${invoice.id}/preview`)}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                            {invoice.invoice_number}
                                        </span>
                                        <span className="font-bold text-slate-900 dark:text-slate-100">
                                            {formatCurrency(invoice.total)}
                                            {invoice.amount_paid > 0 && invoice.open_amount > 0 && (
                                                <span className="block text-xs font-normal text-amber-600">offen {formatCurrency(invoice.open_amount)}</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                {invoice.contact.name}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {new Date(invoice.invoice_date).toLocaleDateString('de-DE')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 font-normal ${statusStyles[invoice.status] || 'bg-slate-100 text-slate-700'}`}>
                                                {statusLabels[invoice.status] || invoice.status}
                                            </Badge>
                                            {invoice.amount_paid > 0 && invoice.open_amount > 0 && (
                                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-amber-700">Teilbezahlt</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <table className="hidden md:table w-full text-sm text-left">
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
                                    <tr
                                        key={invoice.id}
                                        className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/${tenant}/invoices/${invoice.id}/preview`)}
                                    >
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
                                        <td className="px-6 py-4 text-right text-slate-900 dark:text-slate-100">
                                            <div className="font-semibold">{formatCurrency(invoice.total)}</div>
                                            {invoice.amount_paid > 0 && invoice.open_amount > 0 && (
                                                <div className="text-xs text-amber-600">offen {formatCurrency(invoice.open_amount)}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={`font-normal ${statusStyles[invoice.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                    {statusLabels[invoice.status] || invoice.status}
                                                </Badge>
                                                {invoice.amount_paid > 0 && invoice.open_amount > 0 && (
                                                    <Badge variant="outline" className="font-normal text-amber-700">Teilbezahlt</Badge>
                                                )}
                                                {invoice.order && (
                                                    <Badge variant="outline" className="font-normal bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800">
                                                        <Package className="w-3 h-3 mr-1" />
                                                        aus Auftrag
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
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
                                                            onClick={() => navigate(`/${tenant}/invoices/${invoice.id}/edit`)}
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
                                                {invoice.status !== 'draft' && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                                        onClick={() => handleSend(invoice)}
                                                        disabled={sendMutation.isPending}
                                                        title="Versenden"
                                                    >
                                                        <Send className="w-4 h-4 mr-1" />
                                                        <span className="text-xs font-medium">Senden</span>
                                                    </Button>
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

            {paymentDialog.invoice && (
                <PaymentManagement
                    resource="invoices"
                    payableId={paymentDialog.invoice.id}
                    documentLabel={`Rechnung ${paymentDialog.invoice.invoice_number}`}
                    amountPaid={paymentDialog.invoice.amount_paid}
                    openAmount={paymentDialog.invoice.open_amount}
                    open={paymentDialog.open}
                    onOpenChange={(open) => {
                        if (!open) setPaymentDialog({ open: false, invoice: null });
                    }}
                    onChanged={() => queryClient.invalidateQueries({ queryKey: ['invoices'] })}
                    showCard={false}
                />
            )}

            {/* Send Email Modal */}
            {emailModal.invoice && (
                <SendEmailModal
                    open={emailModal.open}
                    onOpenChange={(open) => !open && setEmailModal({ open: false, invoice: null })}
                    documentType="invoice"
                    documentNumber={emailModal.invoice.invoice_number}
                    customerEmail={emailModal.invoice.contact.email}
                    customerName={emailModal.invoice.contact.name}
                    companyName={settings?.company_name || ''}
                    onSend={async (data) => {
                        if (emailModal.invoice) {
                            await sendMutation.mutateAsync({ id: emailModal.invoice.id, emailData: data });
                        }
                    }}
                    isPending={sendMutation.isPending}
                />
            )}
        </div>
    );
}
