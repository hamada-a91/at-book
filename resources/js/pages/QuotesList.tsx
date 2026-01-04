import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from '@/lib/axios';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Trash2, Send, CheckCircle, FileCheck, Edit, Search, Download, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { SendEmailModal, EmailData } from '@/components/SendEmailModal';

interface Quote {
    id: number;
    quote_number: string;
    contact: {
        id: number;
        name: string;
        email?: string;
    };
    quote_date: string;
    valid_until: string;
    status: string;
    total: number;
}

export function QuotesList() {
    const navigate = useNavigate();
    const { tenant } = useParams();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [sendEmailModalOpen, setSendEmailModalOpen] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
    const [emailInput, setEmailInput] = useState('');

    const { data: quotes, isLoading } = useQuery<Quote[]>({
        queryKey: ['quotes'],
        queryFn: async () => {
            const { data } = await axios.get('/api/quotes');
            return data;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const { data } = await axios.delete(`/api/quotes/${id}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
        },
    });

    const sendMutation = useMutation({
        mutationFn: async ({ id, emailData }: { id: number; emailData: EmailData }) => {
            const { data } = await axios.post(`/api/quotes/${id}/send`, emailData);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
            setSendEmailModalOpen(false);
        },
    });

    const acceptMutation = useMutation({
        mutationFn: async (id: number) => {
            const { data } = await axios.post(`/api/quotes/${id}/accept`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
        },
    });

    const createOrderMutation = useMutation({
        mutationFn: async (id: number) => {
            const { data } = await axios.post(`/api/quotes/${id}/create-order`);
            return data;
        },
        onSuccess: (order) => {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            navigate(`/${tenant}/orders/${order.id}`);
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
        sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
        rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
        ordered: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    };

    const statusLabels: Record<string, string> = {
        draft: 'Entwurf',
        sent: 'Versendet',
        accepted: 'Akzeptiert',
        rejected: 'Abgelehnt',
        ordered: 'In Auftrag',
    };

    const handleDelete = (id: number) => {
        if (confirm('Angebot wirklich löschen?')) {
            deleteMutation.mutate(id);
        }
    };

    const updateContactMutation = useMutation({
        mutationFn: async ({ contactId, email }: { contactId: number; email: string }) => {
            // First fetch the contact to get all its data
            const { data: contact } = await axios.get(`/api/contacts/${contactId}`);
            // Then update with all required fields plus the new email
            const { data } = await axios.put(`/api/contacts/${contactId}`, {
                name: contact.name,
                type: contact.type,
                email: email,
                tax_number: contact.tax_number,
                address: contact.address,
                phone: contact.phone,
                notice: contact.notice,
                bank_account: contact.bank_account,
                contact_person: contact.contact_person,
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotes'] });
        },
    });

    const handleSend = (quote: Quote) => {
        // Check if contact has email
        if (!quote.contact.email) {
            setSelectedQuote(quote);
            setEmailDialogOpen(true);
            return;
        }

        // Open email modal for full email composition
        setSelectedQuote(quote);
        setSendEmailModalOpen(true);
    };

    const handleEmailSubmit = async () => {
        if (!selectedQuote || !emailInput) return;

        try {
            // Update contact with email
            await updateContactMutation.mutateAsync({
                contactId: selectedQuote.contact.id,
                email: emailInput,
            });

            setEmailDialogOpen(false);
            setEmailInput('');

            // Update local quote reference with email
            const updatedQuote = { ...selectedQuote, contact: { ...selectedQuote.contact, email: emailInput } };
            setSelectedQuote(updatedQuote);

            // Open send email modal
            setSendEmailModalOpen(true);
        } catch (error) {
            alert('Fehler beim Speichern der Email');
        }
    };

    const handleDownloadPDF = async (quoteId: number) => {
        try {
            const response = await axios.get(`/api/quotes/${quoteId}/download-pdf`, {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Angebot-${quoteId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert('Fehler beim Herunterladen des PDFs');
        }
    };

    const handlePreviewPDF = async (quoteId: number) => {
        try {
            const response = await axios.get(`/api/quotes/${quoteId}/download-pdf`, {
                responseType: 'blob',
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');

            // Clean up the URL after a delay
            setTimeout(() => window.URL.revokeObjectURL(url), 100);
        } catch (error) {
            alert('Fehler beim Öffnen der PDF-Vorschau');
        }
    };

    const handleAccept = (id: number) => {
        if (confirm('Angebot als akzeptiert markieren?')) {
            acceptMutation.mutate(id);
        }
    };

    const handleCreateOrder = (id: number) => {
        if (confirm('Auftrag aus diesem Angebot erstellen?')) {
            createOrderMutation.mutate(id);
        }
    };

    const filteredQuotes = quotes?.filter(quote =>
        quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.contact.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Angebote</h1>
                    <p className="text-slate-500 dark:text-slate-400">Verwalten Sie Ihre Angebote</p>
                </div>
                <Link to={`/${tenant}/quotes/create`}>
                    <Button className="shadow-lg shadow-blue-100/20 hover:shadow-blue-200/30 transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Neues Angebot
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
            </div>

            {/* Quotes List */}
            <Card className="w-full shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                {isLoading ? (
                    <CardContent className="p-12 flex justify-center">
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800 rounded-full mb-4"></div>
                            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
                        </div>
                    </CardContent>
                ) : filteredQuotes && filteredQuotes.length === 0 ? (
                    <CardContent className="p-12 text-center text-slate-500 dark:text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">Keine Angebote gefunden</h3>
                        <p className="mb-6">Erstellen Sie Ihr erstes Angebot, um loszulegen.</p>
                        <Link to={`/${tenant}/quotes/create`}>
                            <Button variant="link" className="text-blue-600 hover:text-blue-800 p-0 h-auto font-normal">
                                Jetzt eines erstellen
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
                                        Gültig bis
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
                                {filteredQuotes?.map((quote) => (
                                    <tr
                                        key={quote.id}
                                        className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/${tenant}/quotes/${quote.id}`)}
                                    >
                                        <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                                            {quote.quote_number}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900 dark:text-slate-100">{quote.contact.name}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            {new Date(quote.quote_date).toLocaleDateString('de-DE')}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('de-DE') : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                                            {formatCurrency(quote.total)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className={`font-normal ${statusStyles[quote.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                {statusLabels[quote.status] || quote.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* Preview and Download - Always visible */}
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                                    onClick={() => handlePreviewPDF(quote.id)}
                                                    title="PDF Vorschau"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                                    onClick={() => handleDownloadPDF(quote.id)}
                                                    title="PDF herunterladen"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </Button>

                                                {/* Status-specific actions */}
                                                {quote.status === 'draft' && (
                                                    <>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                            onClick={() => handleSend(quote)}
                                                            title="Senden"
                                                        >
                                                            <Send className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                                            onClick={() => navigate(`/${tenant}/quotes/${quote.id}/edit`)}
                                                            title="Bearbeiten"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                                            onClick={() => handleDelete(quote.id)}
                                                            title="Löschen"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </>
                                                )}
                                                {quote.status === 'sent' && (
                                                    <>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                            onClick={() => handleAccept(quote.id)}
                                                            title="Akzeptieren"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                        </Button>
                                                    </>
                                                )}
                                                {quote.status === 'accepted' && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                                        onClick={() => handleCreateOrder(quote.id)}
                                                    >
                                                        <FileCheck className="w-4 h-4 mr-1" />
                                                        <span className="text-xs font-medium">Auftrag</span>
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

            {/* Email Dialog */}
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Email-Adresse erforderlich</DialogTitle>
                        <DialogDescription>
                            Der Kontakt "{selectedQuote?.contact.name}" hat keine Email-Adresse hinterlegt.
                            Bitte geben Sie eine Email-Adresse ein, um das Angebot zu versenden.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Email-Adresse *
                        </label>
                        <Input
                            type="email"
                            placeholder="kontakt@beispiel.de"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            className="bg-white dark:bg-slate-950"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && emailInput) {
                                    handleEmailSubmit();
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            onClick={handleEmailSubmit}
                            disabled={!emailInput || updateContactMutation.isPending}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                        >
                            {updateContactMutation.isPending ? 'Speichert...' : 'Speichern & Senden'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Send Email Modal */}
            {selectedQuote && (
                <SendEmailModal
                    open={sendEmailModalOpen}
                    onOpenChange={setSendEmailModalOpen}
                    documentType="quote"
                    documentNumber={selectedQuote.quote_number}
                    customerEmail={selectedQuote.contact.email}
                    customerName={selectedQuote.contact.name}
                    companyName=""
                    onSend={async (emailData) => {
                        await sendMutation.mutateAsync({ id: selectedQuote.id, emailData });
                    }}
                    isPending={sendMutation.isPending}
                />
            )}
        </div>
    );
}
