import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter as UiDialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Edit, Trash2, FileText, Euro, Calendar, User, Download, Eye, Send, Printer, CreditCard, Receipt } from 'lucide-react';
import { SendEmailModal, EmailData } from '@/components/SendEmailModal';

interface Invoice {
    id: number;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    status: string;
    subtotal: number;
    tax_total: number;
    total: number;
    intro_text: string;
    payment_terms: string;
    footer_note: string;
    contact: {
        id: number;
        name: string;
        address: string;
        email?: string;
    };
    lines: Array<{
        id?: number;
        description: string;
        quantity: number;
        unit: string;
        unit_price: number;
        tax_rate: number;
        line_total: number;
    }>;
}

export function InvoicePreview() {
    const { tenant, id } = useParams<{ tenant: string; id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [paymentDialog, setPaymentDialog] = useState(false);
    const [paymentAccount, setPaymentAccount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    const { data: invoice, isLoading } = useQuery<Invoice>({
        queryKey: ['invoice', id],
        queryFn: async () => {
            const { data } = await axios.get(`/api/invoices/${id}`);
            return data;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const { data } = await axios.delete(`/api/invoices/${id}`);
            return data;
        },
        onSuccess: () => {
            navigate(`/${tenant}/invoices`);
        },
    });

    const sendMutation = useMutation({
        mutationFn: async (emailData: EmailData) => {
            const { data } = await axios.post(`/api/invoices/${id}/send`, emailData);
            return data;
        },
        onSuccess: () => {
            setEmailModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['invoice', id] });
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

    // Get accounts for payment (Kasse/Bank)
    const { data: accounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/accounts');
            return data;
        },
    });

    const cashAndBankAccounts = accounts?.filter((a: any) => a.type === 'asset' && (a.code.startsWith('10') || a.code.startsWith('12'))) || [];

    const bookMutation = useMutation({
        mutationFn: async () => {
            const { data } = await axios.post(`/api/invoices/${id}/book`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoice', id] });
        },
    });

    const paymentMutation = useMutation({
        mutationFn: async (data: any) => {
            const { data: resData } = await axios.post(`/api/invoices/${id}/payment`, data);
            return resData;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoice', id] });
            setPaymentDialog(false);
            setPaymentAccount('');
        },
    });

    const handlePayment = () => {
        if (!paymentAccount) return;

        paymentMutation.mutate({
            payment_account_id: parseInt(paymentAccount),
            payment_date: paymentDate,
        });
    };

    const handleDelete = () => {
        if (confirm('Rechnung wirklich löschen?')) {
            deleteMutation.mutate();
        }
    };

    const handleDownloadPDF = async () => {
        try {
            const response = await axios.get(`/api/invoices/${id}/pdf`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${invoice?.invoice_number || 'invoice'}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('PDF download failed:', error);
        }
    };

    const handlePreviewPDF = async () => {
        try {
            const response = await axios.get(`/api/invoices/${id}/pdf`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            setPdfUrl(url);
        } catch (error) {
            console.error('PDF preview failed:', error);
        }
    };

    const handlePrint = () => {
        if (pdfUrl) {
            const printWindow = window.open(pdfUrl, '_blank');
            printWindow?.print();
        } else {
            handlePreviewPDF();
        }
    };

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
        }).format(cents / 100);
    };

    const statusStyles: Record<string, string> = {
        draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        booked: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
        sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        overdue: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
        cancelled: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    };

    const statusLabels: Record<string, string> = {
        draft: 'Entwurf',
        booked: 'Gebucht',
        sent: 'Versendet',
        paid: 'Bezahlt',
        overdue: 'Überfällig',
        cancelled: 'Storniert',
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800 rounded-full mb-4"></div>
                    <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">Rechnung nicht gefunden</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <Link to={`/${tenant}/invoices`}>
                        <Button variant="ghost" size="icon" className="h-10 w-10">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            {invoice.invoice_number}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">{invoice.contact.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`font-normal ${statusStyles[invoice.status]}`}>
                        {statusLabels[invoice.status]}
                    </Badge>
                    <Button variant="outline" onClick={handlePreviewPDF} className="gap-2">
                        <Eye className="w-4 h-4" />
                        PDF Ansehen
                    </Button>
                    <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
                        <Download className="w-4 h-4" />
                        PDF Download
                    </Button>
                    {invoice.status === 'draft' && (
                        <>
                            <Button
                                onClick={() => {
                                    if (confirm('Rechnung jetzt buchen? Dies kann nicht rückgängig gemacht werden.')) {
                                        bookMutation.mutate();
                                    }
                                }}
                                disabled={bookMutation.isPending}
                                className="gap-2 bg-gradient-to-r from-blue-600 to-blue-500"
                            >
                                <Send className="w-4 h-4" />
                                Buchen
                            </Button>
                            <Button variant="outline" onClick={() => navigate(`/${tenant}/invoices/${id}/edit`)} className="gap-2">
                                <Edit className="w-4 h-4" />
                                Bearbeiten
                            </Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending} className="gap-2">
                                <Trash2 className="w-4 h-4" />
                                Löschen
                            </Button>
                        </>
                    )}
                    {invoice.status !== 'draft' && (
                        <Button
                            onClick={() => setEmailModalOpen(true)}
                            disabled={sendMutation.isPending}
                            className="gap-2 bg-gradient-to-r from-purple-600 to-purple-500"
                        >
                            <Send className="w-4 h-4" />
                            Versenden
                        </Button>
                    )}
                    {(invoice.status === 'sent' || invoice.status === 'booked') && (
                        <Button
                            onClick={() => setPaymentDialog(true)}
                            className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500"
                        >
                            <CreditCard className="w-4 h-4" />
                            Als bezahlt markieren
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Details - PDF Preview */}
                <div className="lg:col-span-2 space-y-6">
                    {/* PDF Preview Area */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                        <CardHeader className="border-b border-slate-200 dark:border-slate-700">
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                PDF Vorschau
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {pdfUrl ? (
                                <iframe
                                    src={pdfUrl}
                                    className="w-full h-[600px] border-0"
                                    title="Invoice PDF Preview"
                                />
                            ) : (
                                <div className="h-[400px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50">
                                    <FileText className="w-16 h-16 mb-4 opacity-50" />
                                    <p className="text-lg font-medium mb-2">PDF Vorschau</p>
                                    <p className="text-sm mb-4">Klicken Sie auf den Button um die PDF anzuzeigen</p>
                                    <Button onClick={handlePreviewPDF} className="gap-2">
                                        <Eye className="w-4 h-4" />
                                        PDF laden
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Invoice Info Card */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                Rechnungsdetails
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Rechnungsnummer</p>
                                    <p className="font-mono font-medium text-slate-900 dark:text-slate-100">
                                        {invoice.invoice_number}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Rechnungsdatum</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                        {new Date(invoice.invoice_date).toLocaleDateString('de-DE')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Fällig am</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                        {new Date(invoice.due_date).toLocaleDateString('de-DE')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Kunde</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                        {invoice.contact.name}
                                    </p>
                                </div>
                            </div>

                            {invoice.intro_text && (
                                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Einleitungstext</p>
                                    <p className="text-slate-900 dark:text-slate-100">
                                        {invoice.intro_text}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Line Items */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-primary" />
                                Positionen
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {invoice.lines.map((line, index) => (
                                    <div key={line.id || index} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                                    {line.description}
                                                </p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    {line.quantity} {line.unit} × {formatCurrency(line.unit_price)} | USt. {line.tax_rate}%
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-slate-900 dark:text-slate-100">
                                                    {formatCurrency(line.line_total)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Amount Summary */}
                    <Card className="shadow-sm border-none bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Euro className="w-5 h-5" />
                                Beträge
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 dark:text-slate-400">Nettobetrag:</span>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                    {formatCurrency(invoice.subtotal)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 dark:text-slate-400">Steuerbetrag:</span>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                    {formatCurrency(invoice.tax_total)}
                                </span>
                            </div>
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Gesamtbetrag:</span>
                                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                        {formatCurrency(invoice.total)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <FileText className="w-5 h-5" />
                                Aktionen
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {invoice.status === 'draft' && (
                                <Button
                                    className="w-full gap-2 bg-gradient-to-r from-blue-600 to-blue-500"
                                    onClick={() => {
                                        if (confirm('Rechnung jetzt buchen? Dies kann nicht rückgängig gemacht werden.')) {
                                            bookMutation.mutate();
                                        }
                                    }}
                                    disabled={bookMutation.isPending}
                                >
                                    <Send className="w-4 h-4" />
                                    Buchen
                                </Button>
                            )}
                            {invoice.status !== 'draft' && (
                                <Button
                                    className="w-full gap-2 bg-gradient-to-r from-purple-600 to-purple-500"
                                    onClick={() => setEmailModalOpen(true)}
                                    disabled={sendMutation.isPending}
                                >
                                    <Send className="w-4 h-4" />
                                    Versenden
                                </Button>
                            )}
                            {(invoice.status === 'booked' || invoice.status === 'sent') && (
                                <Button
                                    className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500"
                                    onClick={() => setPaymentDialog(true)}
                                >
                                    <CreditCard className="w-4 h-4" />
                                    Als bezahlt markieren
                                </Button>
                            )}
                            <Button variant="outline" className="w-full gap-2" onClick={handlePreviewPDF}>
                                <Eye className="w-4 h-4" />
                                PDF Vorschau
                            </Button>
                            <Button variant="outline" className="w-full gap-2" onClick={handleDownloadPDF}>
                                <Download className="w-4 h-4" />
                                PDF Herunterladen
                            </Button>
                            <Button variant="outline" className="w-full gap-2" onClick={handlePrint}>
                                <Printer className="w-4 h-4" />
                                Drucken
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Metadata */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <User className="w-5 h-5" />
                                Kunde
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div>
                                <p className="text-slate-500 dark:text-slate-400">Name</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                    {invoice.contact.name}
                                </p>
                            </div>
                            {invoice.contact.address && (
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">Adresse</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100 whitespace-pre-line">
                                        {invoice.contact.address}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Payment & Footer Info */}
                    {(invoice.payment_terms || invoice.footer_note) && (
                        <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <CardContent className="pt-6 space-y-3 text-sm">
                                {invoice.payment_terms && (
                                    <div>
                                        <p className="text-slate-500 dark:text-slate-400">Zahlungsbedingungen</p>
                                        <p className="font-medium text-slate-900 dark:text-slate-100">
                                            {invoice.payment_terms}
                                        </p>
                                    </div>
                                )}
                                {invoice.footer_note && (
                                    <div>
                                        <p className="text-slate-500 dark:text-slate-400">Fußnote</p>
                                        <p className="font-medium text-slate-900 dark:text-slate-100">
                                            {invoice.footer_note}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Send Email Modal */}
            {invoice && (
                <SendEmailModal
                    open={emailModalOpen}
                    onOpenChange={setEmailModalOpen}
                    documentType="invoice"
                    documentNumber={invoice.invoice_number}
                    customerEmail={invoice.contact.email}
                    customerName={invoice.contact.name}
                    companyName={settings?.company_name || ''}
                    onSend={async (data) => {
                        await sendMutation.mutateAsync(data);
                    }}
                    isPending={sendMutation.isPending}
                />
            )}
            {/* Payment Dialog */}
            <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
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
                                <span className="font-mono font-medium">{invoice?.invoice_number}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Offener Betrag:</span>
                                <span className="font-bold text-slate-900 dark:text-slate-100">{invoice && formatCurrency(invoice.total)}</span>
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
                    <UiDialogFooter>
                        <Button variant="outline" onClick={() => setPaymentDialog(false)}>
                            Abbrechen
                        </Button>
                        <Button onClick={handlePayment} disabled={!paymentAccount || paymentMutation.isPending}>
                            {paymentMutation.isPending ? 'Erfasse...' : 'Zahlung buchen'}
                        </Button>
                    </UiDialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
