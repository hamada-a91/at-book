import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, UserPlus, ArrowLeft, Save, X, Calendar, FileText, Eye, Edit, Euro } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Contact {
    id: number;
    name: string;
    type: string;
    address?: string;
}

interface QuoteLine {
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    tax_rate: number;
}

export function QuoteCreate() {
    const navigate = useNavigate();
    const { tenant, id } = useParams();
    const queryClient = useQueryClient();
    const isEditMode = !!id;

    const [customerName, setCustomerName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
    const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
    const [validUntil, setValidUntil] = useState(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [introText, setIntroText] = useState('Wir freuen uns, Ihnen folgendes Angebot unterbreiten zu dürfen.');
    const [paymentTerms, setPaymentTerms] = useState('Zahlbar sofort, rein netto');
    const [footerNote, setFooterNote] = useState('Wir freuen uns auf Ihre Auftragserteilung.');
    const [status, setStatus] = useState('draft');
    const [lines, setLines] = useState<QuoteLine[]>([
        { description: '', quantity: 1, unit: 'Stück', unit_price: 0, tax_rate: 19 },
    ]);

    // Preview mode state
    const [showPreview, setShowPreview] = useState(false);

    const { data: contacts } = useQuery<Contact[]>({
        queryKey: ['contacts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/contacts');
            return data;
        },
    });

    // Load existing quote data if editing
    const { data: existingQuote } = useQuery({
        queryKey: ['quote', id],
        queryFn: async () => {
            if (!id) return null;
            const { data } = await axios.get(`/api/quotes/${id}`);
            return data;
        },
        enabled: !!id,
    });

    // Populate form when quote data loads
    useEffect(() => {
        if (existingQuote) {
            setCustomerName(existingQuote.contact?.name || '');
            setCustomerAddress(existingQuote.contact?.address || '');
            setSelectedContactId(existingQuote.contact?.id || null);
            setQuoteDate(existingQuote.quote_date?.split('T')[0] || '');
            setValidUntil(existingQuote.valid_until?.split('T')[0] || '');
            setIntroText(existingQuote.intro_text || 'Wir freuen uns, Ihnen folgendes Angebot unterbreiten zu dürfen.');
            setPaymentTerms(existingQuote.payment_terms || 'Zahlbar sofort, rein netto');
            setFooterNote(existingQuote.footer_note || 'Wir freuen uns auf Ihre Auftragserteilung.');
            setStatus(existingQuote.status || 'draft');

            if (existingQuote.lines && existingQuote.lines.length > 0) {
                setLines(existingQuote.lines.map((line: any) => ({
                    description: line.description,
                    quantity: parseFloat(line.quantity) || 1,
                    unit: line.unit || 'Stück',
                    unit_price: (line.unit_price / 100) || 0, // Convert from cents
                    tax_rate: parseFloat(line.tax_rate) || 19,
                })));
            }
        }
    }, [existingQuote]);

    const createContactMutation = useMutation({
        mutationFn: async (data: any) => {
            try {
                const { data: resData } = await axios.post('/api/contacts', data);
                return resData;
            } catch (error: any) {
                throw new Error('Fehler beim Erstellen des Kunden');
            }
        },
        onSuccess: (newContact) => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            setSelectedContactId(newContact.id);
        },
    });

    const createQuoteMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = isEditMode ? `/api/quotes/${id}` : '/api/quotes';
            const method = isEditMode ? 'put' : 'post';

            try {
                // @ts-ignore
                const { data: resData } = await axios[method](url, data);
                return resData;
            } catch (error: any) {
                throw new Error(error.response?.data?.message || 'Fehler beim Speichern');
            }
        },
        onSuccess: () => {
            navigate(`/${tenant}/quotes`);
        },
    });

    const customers = contacts?.filter((c) => c.type === 'customer') || [];

    // Auto-fill address when customer is selected from suggestions
    const handleCustomerSelect = (contact: Contact) => {
        setCustomerName(contact.name);
        setCustomerAddress(contact.address || '');
        setSelectedContactId(contact.id);
    };

    const addLine = () => {
        setLines([...lines, {
            description: '',
            quantity: 1,
            unit: 'Stück',
            unit_price: 0,
            tax_rate: 19,
        }]);
    };

    const removeLine = (index: number) => {
        setLines(lines.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: keyof QuoteLine, value: any) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLines(newLines);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let contactId = selectedContactId;

        // If no contact selected, create new one
        if (!contactId) {
            try {
                const newContact = await createContactMutation.mutateAsync({
                    name: customerName,
                    type: 'customer',
                    address: customerAddress,
                });
                contactId = newContact.id;
            } catch (error) {
                alert('Fehler beim Erstellen des Kunden');
                return;
            }
        }

        const formattedLines = lines.map((line) => ({
            description: line.description,
            quantity: parseFloat(line.quantity.toString()),
            unit: line.unit,
            unit_price: Math.round(parseFloat(line.unit_price.toString()) * 100), // convert to cents
            tax_rate: parseFloat(line.tax_rate.toString()),
        }));

        createQuoteMutation.mutate({
            contact_id: contactId,
            quote_date: quoteDate,
            valid_until: validUntil,
            intro_text: introText,
            payment_terms: paymentTerms,
            footer_note: footerNote,
            status: status,
            lines: formattedLines,
        });
    };

    const calculateTotal = () => {
        return lines.reduce((sum, line) => {
            const subtotal = line.quantity * line.unit_price;
            const tax = subtotal * (line.tax_rate / 100);
            return sum + subtotal + tax;
        }, 0);
    };

    const calculateSubtotal = () => {
        return lines.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0);
    };

    const calculateTax = () => {
        return lines.reduce((sum, line) => {
            const subtotal = line.quantity * line.unit_price;
            return sum + (subtotal * (line.tax_rate / 100));
        }, 0);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
        }).format(amount);
    };

    // Validate form before showing preview
    const canShowPreview = () => {
        return customerName.trim() !== '' &&
            lines.length > 0 &&
            lines.every(line => line.description.trim() !== '');
    };

    // Filter customers for autocomplete
    const filteredCustomers = customerName
        ? customers.filter((c) =>
            c.name.toLowerCase().includes(customerName.toLowerCase())
        )
        : [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {showPreview ? (
                    /* Preview Mode - Show quote preview before saving */
                    <>
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                                onClick={() => setShowPreview(false)}
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                    Vorschau des Angebots
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                    Überprüfen Sie die Daten bevor Sie speichern
                                </p>
                            </div>
                        </div>

                        {/* Preview Content Card */}
                        <Card className="shadow-xl border-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
                            <CardHeader className="border-b border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <Badge variant="outline" className="mb-2 bg-amber-100 text-amber-700 border-amber-200">
                                            Entwurf - Noch nicht gespeichert
                                        </Badge>
                                        <CardTitle className="text-2xl">
                                            Angebotsdatum: {new Date(quoteDate).toLocaleDateString('de-DE')}
                                        </CardTitle>
                                        <CardDescription>
                                            Gültig bis: {new Date(validUntil).toLocaleDateString('de-DE')}
                                        </CardDescription>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Gesamtbetrag</p>
                                        <p className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                                            {formatCurrency(calculateTotal())}
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                {/* Customer Info */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            Angebotsempfänger
                                        </h3>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                            <p className="font-semibold text-slate-900 dark:text-slate-100">{customerName}</p>
                                            <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line mt-1">{customerAddress || '-'}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                                            <Calendar className="w-4 h-4" />
                                            Angebotsdetails
                                        </h3>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-slate-600 dark:text-slate-400">Angebotsdatum:</span>
                                                <span className="font-medium">{new Date(quoteDate).toLocaleDateString('de-DE')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600 dark:text-slate-400">Gültig bis:</span>
                                                <span className="font-medium">{new Date(validUntil).toLocaleDateString('de-DE')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Intro Text */}
                                {introText && (
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                        <p className="text-slate-700 dark:text-slate-300">{introText}</p>
                                    </div>
                                )}

                                {/* Line Items */}
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                                        <Euro className="w-4 h-4" />
                                        Positionen
                                    </h3>
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Beschreibung</th>
                                                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Menge</th>
                                                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300">Einheit</th>
                                                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Einzelpreis</th>
                                                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">USt.</th>
                                                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Gesamt</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                {lines.map((line, idx) => (
                                                    <tr key={idx}>
                                                        <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{line.description}</td>
                                                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{line.quantity}</td>
                                                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{line.unit}</td>
                                                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(line.unit_price)}</td>
                                                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{line.tax_rate}%</td>
                                                        <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                                                            {formatCurrency(line.quantity * line.unit_price * (1 + line.tax_rate / 100))}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Totals */}
                                <div className="flex justify-end">
                                    <div className="w-80 space-y-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">Nettobetrag:</span>
                                            <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">Umsatzsteuer:</span>
                                            <span className="font-medium">{formatCurrency(calculateTax())}</span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t border-slate-300 dark:border-slate-600">
                                            <span className="font-semibold text-slate-900 dark:text-slate-100">Gesamtbetrag:</span>
                                            <span className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                                                {formatCurrency(calculateTotal())}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Terms & Footer */}
                                {(paymentTerms || footerNote) && (
                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                        {paymentTerms && (
                                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">Zahlungsbedingungen</p>
                                                <p className="text-sm text-green-800 dark:text-green-300">{paymentTerms}</p>
                                            </div>
                                        )}
                                        {footerNote && (
                                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Fußnote</p>
                                                <p className="text-sm text-slate-600 dark:text-slate-300">{footerNote}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Preview Actions */}
                        <div className="flex justify-between items-center p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg">
                            <Button
                                variant="outline"
                                onClick={() => setShowPreview(false)}
                                className="gap-2"
                            >
                                <Edit className="w-4 h-4" />
                                Zurück zum Bearbeiten
                            </Button>
                            <div className="flex gap-3">
                                <Link to={`/${tenant}/quotes`}>
                                    <Button variant="ghost" className="gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                                        <X className="w-4 h-4" />
                                        Verwerfen
                                    </Button>
                                </Link>
                                <Button
                                    onClick={() => handleSubmit({ preventDefault: () => { } } as React.FormEvent)}
                                    disabled={createQuoteMutation.isPending || createContactMutation.isPending}
                                    className="gap-2 shadow-lg shadow-emerald-100/20 hover:shadow-emerald-200/30 transition-all duration-300 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                                >
                                    <Save className="w-4 h-4" />
                                    {createQuoteMutation.isPending ? 'Speichere...' : 'Angebot erstellen'}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Edit Mode - Show the form */
                    <>
                        <div className="flex items-center gap-4">
                            <Link to={`/${tenant}/quotes`}>
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {isEditMode ? 'Angebot bearbeiten' : 'Neues Angebot'}
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                    {isEditMode ? 'Bearbeite die Angebotsdaten' : 'Erstelle ein neues Angebot'}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Customer Info */}
                            <Card className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                                <CardHeader className="border-b border-gray-200 dark:border-gray-700">
                                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                                        <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        Kundeninformationen
                                    </CardTitle>
                                    <CardDescription className="text-gray-600 dark:text-gray-400">
                                        Wählen Sie einen bestehenden Kunden oder geben Sie einen neuen ein.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="relative">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                Kundenname *
                                            </label>
                                            <Input
                                                value={customerName}
                                                onChange={(e) => {
                                                    setCustomerName(e.target.value);
                                                    setSelectedContactId(null);
                                                }}
                                                placeholder="Name eingeben..."
                                                required
                                                className="bg-white dark:bg-slate-950"
                                            />
                                            {/* Autocomplete dropdown */}
                                            {customerName && filteredCustomers.length > 0 && !selectedContactId && (
                                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                                                    {filteredCustomers.map((contact) => (
                                                        <button
                                                            key={contact.id}
                                                            type="button"
                                                            onClick={() => handleCustomerSelect(contact)}
                                                            className="px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between w-full"
                                                        >
                                                            <span className="text-slate-900 dark:text-slate-100">{contact.name}</span>
                                                            <span className="text-xs text-slate-500 dark:text-slate-400">Vorhanden</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {selectedContactId && (
                                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                                                    <span className="inline-block w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px]">✓</span>
                                                    Kunde ausgewählt
                                                </p>
                                            )}
                                            {customerName && !selectedContactId && filteredCustomers.length === 0 && (
                                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                                                    <UserPlus className="w-3 h-3" />
                                                    Neuer Kunde wird erstellt
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                Adresse
                                            </label>
                                            <Textarea
                                                value={customerAddress}
                                                onChange={(e) => setCustomerAddress(e.target.value)}
                                                placeholder="Straße, PLZ Stadt"
                                                rows={3}
                                                className="bg-white dark:bg-slate-950 resize-none"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Quote Details */}
                            <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-primary" />
                                        Angebotsdetails
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                Angebotsdatum *
                                            </label>
                                            <Input
                                                type="date"
                                                value={quoteDate}
                                                onChange={(e) => setQuoteDate(e.target.value)}
                                                required
                                                className="bg-white dark:bg-slate-950"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                Gültig bis
                                            </label>
                                            <Input
                                                type="date"
                                                value={validUntil}
                                                onChange={(e) => setValidUntil(e.target.value)}
                                                className="bg-white dark:bg-slate-950"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Einleitungstext
                                        </label>
                                        <Textarea
                                            value={introText}
                                            onChange={(e) => setIntroText(e.target.value)}
                                            rows={2}
                                            placeholder="Wir freuen uns, Ihnen folgendes Angebot unterbreiten zu dürfen."
                                            className="bg-white dark:bg-slate-950 resize-none"
                                        />
                                    </div>
                                    {isEditMode && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                Status
                                            </label>
                                            <Select value={status} onValueChange={setStatus}>
                                                <SelectTrigger className="bg-white dark:bg-slate-950">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="draft">Entwurf</SelectItem>
                                                    <SelectItem value="sent">Versendet</SelectItem>
                                                    <SelectItem value="accepted">Akzeptiert</SelectItem>
                                                    <SelectItem value="rejected">Abgelehnt</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                Status kann bei Bedarf manuell geändert werden
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Line Items */}
                            <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-primary" />
                                            Positionen
                                        </CardTitle>
                                        <Button type="button" size="sm" onClick={addLine} className="gap-2">
                                            <Plus className="w-4 h-4" />
                                            Position hinzufügen
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {lines.map((line, index) => (
                                            <div
                                                key={index}
                                                className="grid grid-cols-12 gap-4 p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800"
                                            >
                                                <div className="col-span-12 md:col-span-3">
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                        Beschreibung *
                                                    </label>
                                                    <Input
                                                        value={line.description}
                                                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                                                        required
                                                        placeholder="Leistung/Artikel"
                                                        className="bg-white dark:bg-slate-950"
                                                    />
                                                </div>
                                                <div className="col-span-6 md:col-span-1">
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                        Menge *
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        step="1"
                                                        min="1"
                                                        value={line.quantity}
                                                        onChange={(e) =>
                                                            updateLine(index, 'quantity', parseInt(e.target.value) || 1)
                                                        }
                                                        required
                                                        className="bg-white dark:bg-slate-950"
                                                    />
                                                </div>
                                                <div className="col-span-6 md:col-span-2">
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                        Einheit *
                                                    </label>
                                                    <Select
                                                        value={line.unit}
                                                        onValueChange={(value) => updateLine(index, 'unit', value)}
                                                    >
                                                        <SelectTrigger className="bg-white dark:bg-slate-950">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Stück">Stück</SelectItem>
                                                            <SelectItem value="Stunde">Stunde</SelectItem>
                                                            <SelectItem value="Tag">Tag</SelectItem>
                                                            <SelectItem value="Monat">Monat</SelectItem>
                                                            <SelectItem value="Pauschal">Pauschal</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="col-span-6 md:col-span-2">
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                        Einzelpreis (€) *
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={line.unit_price}
                                                        onChange={(e) =>
                                                            updateLine(index, 'unit_price', parseFloat(e.target.value))
                                                        }
                                                        required
                                                        className="bg-white dark:bg-slate-950"
                                                    />
                                                </div>
                                                <div className="col-span-6 md:col-span-2">
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                        USt. % *
                                                    </label>
                                                    <Select
                                                        value={line.tax_rate.toString()}
                                                        onValueChange={(value) => updateLine(index, 'tax_rate', parseFloat(value))}
                                                        defaultValue="19"
                                                    >
                                                        <SelectTrigger className="bg-white dark:bg-slate-950">
                                                            <SelectValue placeholder="19% USt." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="19">19% USt.</SelectItem>
                                                            <SelectItem value="7">7% USt.</SelectItem>
                                                            <SelectItem value="0">0% (steuerfrei)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="col-span-10 md:col-span-1 flex items-center justify-center pt-6">
                                                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                        {(line.quantity * line.unit_price * (1 + line.tax_rate / 100)).toFixed(2)} €
                                                    </span>
                                                </div>
                                                <div className="col-span-2 md:col-span-1 flex items-end">
                                                    {lines.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => removeLine(index)}
                                                            className="w-full hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-500"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Total */}
                                    <div className="mt-6 flex justify-end">
                                        <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-lg border border-slate-100 dark:border-slate-700 min-w-[250px]">
                                            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Gesamtsumme (inkl. MwSt)</div>
                                            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                                                {calculateTotal().toFixed(2)} €
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Payment Terms Section */}
                            <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-primary" />
                                        Zahlungsangaben (optional)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Zahlungsbedingung
                                        </label>
                                        <Input
                                            value={paymentTerms}
                                            onChange={(e) => setPaymentTerms(e.target.value)}
                                            placeholder="Zahlbar sofort, rein netto"
                                            className="bg-white dark:bg-slate-950"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Nachbemerkung
                                        </label>
                                        <Textarea
                                            value={footerNote}
                                            onChange={(e) => setFooterNote(e.target.value)}
                                            rows={2}
                                            placeholder="Wir freuen uns auf Ihre Auftragserteilung."
                                            className="bg-white dark:bg-slate-950 resize-none"
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Actions */}
                            <div className="flex justify-end gap-4 pb-8">
                                <Link to={`/${tenant}/quotes`}>
                                    <Button type="button" variant="outline" className="gap-2">
                                        <X className="w-4 h-4" />
                                        Abbrechen
                                    </Button>
                                </Link>
                                {isEditMode ? (
                                    <Button
                                        type="submit"
                                        disabled={createQuoteMutation.isPending || createContactMutation.isPending}
                                        className="gap-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-lg shadow-indigo-500/30"
                                    >
                                        <Save className="w-4 h-4" />
                                        {createQuoteMutation.isPending ? 'Speichere...' : 'Änderungen speichern'}
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            if (canShowPreview()) {
                                                setShowPreview(true);
                                            } else {
                                                alert('Bitte füllen Sie alle Pflichtfelder aus (Kunde, Beschreibung).');
                                            }
                                        }}
                                        className="gap-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-lg shadow-indigo-500/30"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Vorschau anzeigen
                                    </Button>
                                )}
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

