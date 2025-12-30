import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Trash2, FileText, Package, Euro, Calendar, User, Download, Eye, Send, CheckCircle } from 'lucide-react';
import { SendEmailModal, EmailData } from '@/components/SendEmailModal';

interface QuoteLine {
    id: number;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    tax_rate: number;
    line_total: number;
}

interface Quote {
    id: number;
    quote_number: string;
    contact: {
        id: number;
        name: string;
        address?: string;
        email?: string;
    };
    quote_date: string;
    valid_until?: string;
    status: string;
    subtotal: number;
    tax_total: number;
    total: number;
    intro_text?: string;
    payment_terms?: string;
    footer_note?: string;
    notes?: string;
    lines: QuoteLine[];
    created_at: string;
    updated_at: string;
}

export function QuotePreview() {
    const navigate = useNavigate();
    const { tenant, id } = useParams<{ tenant: string; id: string }>();
    const queryClient = useQueryClient();
    const [emailModalOpen, setEmailModalOpen] = useState(false);

    const { data: quote, isLoading } = useQuery<Quote>({
        queryKey: ['quote', id],
        queryFn: async () => {
            const { data } = await axios.get(`/api/quotes/${id}`);
            return data;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const { data } = await axios.delete(`/api/quotes/${id}`);
            return data;
        },
        onSuccess: () => {
            navigate(`/${tenant}/quotes`);
        },
    });

    const sendMutation = useMutation({
        mutationFn: async (emailData: EmailData) => {
            const { data } = await axios.post(`/api/quotes/${id}/send`, emailData);
            return data;
        },
        onSuccess: () => {
            setEmailModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['quote', id] });
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

    const acceptMutation = useMutation({
        mutationFn: async () => {
            const { data } = await axios.post(`/api/quotes/${id}/accept`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quote', id] });
        },
    });

    const createOrderMutation = useMutation({
        mutationFn: async () => {
            const { data } = await axios.post(`/api/quotes/${id}/create-order`);
            return data;
        },
        onSuccess: (data) => {
            navigate(`/${tenant}/orders/${data.id}`);
        },
    });

    const handleDelete = () => {
        if (confirm('Angebot wirklich löschen?')) {
            deleteMutation.mutate();
        }
    };

    const handleDownloadPDF = async () => {
        try {
            const response = await axios.get(`/api/quotes/${id}/download-pdf`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${quote?.quote_number || 'quote'}.pdf`);
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
            const response = await axios.get(`/api/quotes/${id}/download-pdf`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            window.open(url, '_blank');
        } catch (error) {
            console.error('PDF preview failed:', error);
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
        sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
        expired: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
        ordered: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    };

    const statusLabels: Record<string, string> = {
        draft: 'Entwurf',
        sent: 'Versendet',
        accepted: 'Akzeptiert',
        rejected: 'Abgelehnt',
        expired: 'Abgelaufen',
        ordered: 'Bestellt',
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

    if (!quote) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">Angebot nicht gefunden</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to={`/${tenant}/quotes`}>
                        <Button variant="ghost" size="icon" className="h-10 w-10">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            {quote.quote_number}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">{quote.contact.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`font-normal ${statusStyles[quote.status]}`}>
                        {statusLabels[quote.status]}
                    </Badge>
                    <Button variant="outline" onClick={handlePreviewPDF} className="gap-2">
                        <Eye className="w-4 h-4" />
                        PDF Ansehen
                    </Button>
                    <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
                        <Download className="w-4 h-4" />
                        PDF Download
                    </Button>
                    <Button
                        onClick={() => setEmailModalOpen(true)}
                        disabled={sendMutation.isPending}
                        className="gap-2 bg-gradient-to-r from-purple-600 to-purple-500"
                    >
                        <Send className="w-4 h-4" />
                        Versenden
                    </Button>
                    {quote.status === 'draft' && (
                        <>
                            <Button variant="outline" onClick={() => navigate(`/${tenant}/quotes/${id}/edit`)} className="gap-2">
                                <Edit className="w-4 h-4" />
                                Bearbeiten
                            </Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending} className="gap-2">
                                <Trash2 className="w-4 h-4" />
                                Löschen
                            </Button>
                        </>
                    )}
                    {quote.status === 'sent' && (
                        <Button
                            onClick={() => acceptMutation.mutate()}
                            disabled={acceptMutation.isPending}
                            className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Akzeptieren
                        </Button>
                    )}
                    {quote.status === 'accepted' && (
                        <Button
                            onClick={() => createOrderMutation.mutate()}
                            disabled={createOrderMutation.isPending}
                            className="gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500"
                        >
                            <Package className="w-4 h-4" />
                            Auftrag erstellen
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Quote Info */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                Angebotsdetails
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Angebotsnummer</p>
                                    <p className="font-mono font-medium text-slate-900 dark:text-slate-100">
                                        {quote.quote_number}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Angebotsdatum</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                        {new Date(quote.quote_date).toLocaleDateString('de-DE')}
                                    </p>
                                </div>
                                {quote.valid_until && (
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Gültig bis</p>
                                        <p className="font-medium text-slate-900 dark:text-slate-100">
                                            {new Date(quote.valid_until).toLocaleDateString('de-DE')}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Kunde</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                        {quote.contact.name}
                                    </p>
                                </div>
                            </div>

                            {quote.intro_text && (
                                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Einleitungstext</p>
                                    <p className="text-slate-900 dark:text-slate-100">
                                        {quote.intro_text}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Line Items */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                Positionen
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {quote.lines.map((line) => (
                                    <div key={line.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
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
                                    {formatCurrency(quote.subtotal)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 dark:text-slate-400">Steuerbetrag:</span>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                    {formatCurrency(quote.tax_total)}
                                </span>
                            </div>
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Gesamtbetrag:</span>
                                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                        {formatCurrency(quote.total)}
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
                            <Button
                                className="w-full gap-2 bg-gradient-to-r from-purple-600 to-purple-500"
                                onClick={() => setEmailModalOpen(true)}
                                disabled={sendMutation.isPending}
                            >
                                <Send className="w-4 h-4" />
                                Versenden
                            </Button>
                            {quote.status === 'sent' && (
                                <Button
                                    className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500"
                                    onClick={() => acceptMutation.mutate()}
                                    disabled={acceptMutation.isPending}
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Akzeptieren
                                </Button>
                            )}
                            {quote.status === 'accepted' && (
                                <Button
                                    className="w-full gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500"
                                    onClick={() => createOrderMutation.mutate()}
                                    disabled={createOrderMutation.isPending}
                                >
                                    <Package className="w-4 h-4" />
                                    Auftrag erstellen
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
                        </CardContent>
                    </Card>

                    {/* Metadata */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <User className="w-5 h-5" />
                                Metadaten
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div>
                                <p className="text-slate-500 dark:text-slate-400">Erstellt am</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                    {new Date(quote.created_at).toLocaleString('de-DE')}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-500 dark:text-slate-400">Zuletzt geändert</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                    {new Date(quote.updated_at).toLocaleString('de-DE')}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Send Email Modal */}
            {quote && (
                <SendEmailModal
                    open={emailModalOpen}
                    onOpenChange={setEmailModalOpen}
                    documentType="quote"
                    documentNumber={quote.quote_number}
                    customerEmail={quote.contact.email}
                    customerName={quote.contact.name}
                    companyName={settings?.company_name || ''}
                    onSend={async (data) => {
                        await sendMutation.mutateAsync(data);
                    }}
                    isPending={sendMutation.isPending}
                />
            )}
        </div>
    );
}
