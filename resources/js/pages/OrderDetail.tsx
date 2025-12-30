import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Trash2, FileText, Package, Euro, Calendar, User, Download, Printer, Eye, Receipt, Send } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { SendEmailModal, EmailData } from '@/components/SendEmailModal';

interface OrderLine {
    id: number;
    description: string;
    quantity: number;
    delivered_quantity: number;
    invoiced_quantity: number;
    unit: string;
    unit_price: number;
    tax_rate: number;
    line_total: number;
}

interface Order {
    id: number;
    order_number: string;
    contact: {
        id: number;
        name: string;
        email?: string;
    };
    order_date: string;
    delivery_date?: string;
    status: string;
    subtotal: number;
    tax_total: number;
    total: number;
    intro_text?: string;
    payment_terms?: string;
    footer_note?: string;
    notes?: string;
    lines: OrderLine[];
    created_at: string;
    updated_at: string;
}

export function OrderDetail() {
    const navigate = useNavigate();
    const { tenant, id } = useParams<{ tenant: string; id: string }>();
    const queryClient = useQueryClient();
    const [emailModalOpen, setEmailModalOpen] = useState(false);

    const { data: order, isLoading } = useQuery<Order>({
        queryKey: ['order', id],
        queryFn: async () => {
            const { data } = await axios.get(`/api/orders/${id}`);
            return data;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const { data } = await axios.delete(`/api/orders/${id}`);
            return data;
        },
        onSuccess: () => {
            navigate(`/${tenant}/orders`);
        },
    });

    const handleDelete = () => {
        if (confirm('Auftrag wirklich löschen?')) {
            deleteMutation.mutate();
        }
    };

    const sendMutation = useMutation({
        mutationFn: async (emailData: EmailData) => {
            const { data } = await axios.post(`/api/orders/${id}/send`, emailData);
            return data;
        },
        onSuccess: () => {
            setEmailModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['order', id] });
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

    const handleDownloadPDF = async () => {
        try {
            const response = await axios.get(`/api/orders/${id}/download-pdf`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${order?.order_number || 'order'}.pdf`);
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
            const response = await axios.get(`/api/orders/${id}/download-pdf`, {
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

    const getDeliveryProgress = (line: OrderLine) => {
        return (line.delivered_quantity / line.quantity) * 100;
    };

    const getInvoiceProgress = (line: OrderLine) => {
        return (line.invoiced_quantity / line.quantity) * 100;
    };

    const statusStyles: Record<string, string> = {
        open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        partial_delivered: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
        delivered: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
        partial_invoiced: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        invoiced: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    };

    const statusLabels: Record<string, string> = {
        open: 'Offen',
        partial_delivered: 'Teilgeliefert',
        delivered: 'Geliefert',
        partial_invoiced: 'Teilberechnet',
        invoiced: 'Berechnet',
        completed: 'Abgeschlossen',
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

    if (!order) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">Auftrag nicht gefunden</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to={`/${tenant}/orders`}>
                        <Button variant="ghost" size="icon" className="h-10 w-10">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            {order.order_number}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">{order.contact.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`font-normal ${statusStyles[order.status]}`}>
                        {statusLabels[order.status]}
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
                    {order.status !== 'invoiced' && order.status !== 'completed' && (
                        <Button
                            onClick={() => navigate(`/${tenant}/invoices/create?from_order=${order.id}`)}
                            className="gap-2 bg-gradient-to-r from-green-600 to-green-500"
                        >
                            <Receipt className="w-4 h-4" />
                            Rechnung erstellen
                        </Button>
                    )}
                    {order.status === 'open' && (
                        <>
                            <Button variant="outline" onClick={() => navigate(`/${tenant}/orders/${id}/edit`)} className="gap-2">
                                <Edit className="w-4 h-4" />
                                Bearbeiten
                            </Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending} className="gap-2">
                                <Trash2 className="w-4 h-4" />
                                Löschen
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Order Info */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                Auftragsdetails
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Auftragsnummer</p>
                                    <p className="font-mono font-medium text-slate-900 dark:text-slate-100">
                                        {order.order_number}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Auftragsdatum</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                        {new Date(order.order_date).toLocaleDateString('de-DE')}
                                    </p>
                                </div>
                                {order.delivery_date && (
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Lieferdatum</p>
                                        <p className="font-medium text-slate-900 dark:text-slate-100">
                                            {new Date(order.delivery_date).toLocaleDateString('de-DE')}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Kunde</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                        {order.contact.name}
                                    </p>
                                </div>
                            </div>

                            {order.intro_text && (
                                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Einleitungstext</p>
                                    <p className="text-slate-900 dark:text-slate-100">
                                        {order.intro_text}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Line Items with Progress */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-primary" />
                                Positionen
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {order.lines.map((line, index) => (
                                    <div key={line.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-3">
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

                                        {/* Delivery Progress */}
                                        <div>
                                            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                                                <span>Geliefert</span>
                                                <span>{line.delivered_quantity} / {line.quantity} {line.unit}</span>
                                            </div>
                                            <Progress value={getDeliveryProgress(line)} className="h-2" />
                                        </div>

                                        {/* Invoice Progress */}
                                        <div>
                                            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                                                <span>Berechnet</span>
                                                <span>{line.invoiced_quantity} / {line.quantity} {line.unit}</span>
                                            </div>
                                            <Progress value={getInvoiceProgress(line)} className="h-2" />
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
                                    {formatCurrency(order.subtotal)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 dark:text-slate-400">Steuerbetrag:</span>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                    {formatCurrency(order.tax_total)}
                                </span>
                            </div>
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Gesamtbetrag:</span>
                                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                        {formatCurrency(order.total)}
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
                            {order.status !== 'invoiced' && order.status !== 'completed' && (
                                <Button
                                    className="w-full gap-2 bg-gradient-to-r from-green-600 to-green-500"
                                    onClick={() => navigate(`/${tenant}/invoices/create?from_order=${order.id}`)}
                                >
                                    <Receipt className="w-4 h-4" />
                                    Rechnung erstellen
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
                                    {new Date(order.created_at).toLocaleString('de-DE')}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-500 dark:text-slate-400">Zuletzt geändert</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                    {new Date(order.updated_at).toLocaleString('de-DE')}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Send Email Modal */}
            {order && (
                <SendEmailModal
                    open={emailModalOpen}
                    onOpenChange={setEmailModalOpen}
                    documentType="order"
                    documentNumber={order.order_number}
                    customerEmail={order.contact.email}
                    customerName={order.contact.name}
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
