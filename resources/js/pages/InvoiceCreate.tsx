import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import axios from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus, Trash2, UserPlus, ArrowLeft, Save, X, Calendar, FileText, CreditCard, Eye, Edit, Euro } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProductSelector } from '@/components/ProductSelector';

interface Contact {
    id: number;
    name: string;
    type: string;
    address?: string;
}

interface Account {
    id: number;
    code: string;
    name: string;
    type: string;
}

interface InvoiceLine {
    product_id?: number | null;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    tax_rate: number;
    account_id: string;
}

interface Product {
    id: number;
    name: string;
    type: string;
    unit: string;
    price_net: number;
    price_gross: number;
    tax_rate: number;
}

// Tax rate to revenue account mapping
const TAX_ACCOUNT_MAP: Record<number, string> = {
    19: '8400', // Erlöse 19% USt
    7: '8300',  // Erlöse 7% USt  
    0: '8100',  // Erlöse steuerfrei
};

export function InvoiceCreate() {
    const navigate = useNavigate();
    const { tenant, id } = useParams();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const isEditMode = !!id;

    // Check if creating from an order
    const orderIdParam = searchParams.get('from_order');
    const fromOrderId = orderIdParam ? parseInt(orderIdParam) : null;

    const [customerName, setCustomerName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [originalContactAddress, setOriginalContactAddress] = useState<string | null>(null);
    const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [introText, setIntroText] = useState('Unsere Lieferungen/Leistungen stellen wir Ihnen wie folgt in Rechnung.');
    const [paymentTerms, setPaymentTerms] = useState('Zahlbar sofort, rein netto');
    const [footerNote, setFooterNote] = useState('Vielen Dank für die gute Zusammenarbeit.');
    const [lines, setLines] = useState<InvoiceLine[]>([
        { description: '', quantity: 1, unit: 'Stück', unit_price: 0, tax_rate: 19, account_id: '' },
    ]);

    // Address change dialog state
    const [addressDialogOpen, setAddressDialogOpen] = useState(false);
    const [pendingSubmitData, setPendingSubmitData] = useState<any>(null);

    // Preview mode state - show preview before final save
    const [showPreview, setShowPreview] = useState(false);

    const { data: contacts } = useQuery<Contact[]>({
        queryKey: ['contacts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/contacts');
            return data;
        },
    });

    const { data: accounts } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/accounts');
            return data;
        },
    });

    // Load existing invoice data if editing
    const { data: existingInvoice } = useQuery({
        queryKey: ['invoice', id],
        queryFn: async () => {
            if (!id) return null;
            const { data } = await axios.get(`/api/invoices/${id}`);
            return data;
        },
        enabled: !!id,
    });

    // Fetch order data if creating from order
    const { data: sourceOrder } = useQuery({
        queryKey: ['order', fromOrderId],
        queryFn: async () => {
            if (!fromOrderId) return null;
            const { data } = await axios.get(`/api/orders/${fromOrderId}`);
            return data;
        },
        enabled: !!fromOrderId && !isEditMode,
    });

    // Populate form from order data
    useEffect(() => {
        if (sourceOrder && !isEditMode) {
            setCustomerName(sourceOrder.contact?.name || '');
            setCustomerAddress(sourceOrder.contact?.address || '');
            setSelectedContactId(sourceOrder.contact?.id || null);
            setIntroText(sourceOrder.intro_text || 'Unsere Lieferungen/Leistungen stellen wir Ihnen wie folgt in Rechnung.');
            setPaymentTerms(sourceOrder.payment_terms || 'Zahlbar sofort, rein netto');
            setFooterNote(sourceOrder.footer_note || 'Vielen Dank für die gute Zusammenarbeit.');

            if (sourceOrder.lines && sourceOrder.lines.length > 0) {
                setLines(sourceOrder.lines.map((line: any) => {
                    // Try to find the right account based on tax rate
                    let accountId = '';
                    if (accounts && accounts.length > 0) {
                        const taxRate = parseFloat(line.tax_rate) || 19;
                        const accountCode = TAX_ACCOUNT_MAP[taxRate] || TAX_ACCOUNT_MAP[19];
                        let account = accounts.find(a => a.code === accountCode);
                        if (!account) {
                            account = accounts.find(a => a.type === 'revenue' && a.code.startsWith('8'));
                        }
                        if (account) {
                            accountId = account.id.toString();
                        }
                    }

                    return {
                        description: line.description,
                        quantity: parseFloat(line.quantity) || 1,
                        unit: line.unit || 'Stück',
                        unit_price: (line.unit_price / 100) || 0,
                        tax_rate: parseFloat(line.tax_rate) || 19,
                        account_id: accountId,
                    };
                }));
            }
        }
    }, [sourceOrder, isEditMode, accounts]);

    // Populate form when invoice data loads
    useEffect(() => {
        if (existingInvoice) {
            setCustomerName(existingInvoice.contact?.name || '');
            setCustomerAddress(existingInvoice.contact?.address || '');
            setSelectedContactId(existingInvoice.contact?.id || null);
            setInvoiceDate(existingInvoice.invoice_date?.split('T')[0] || '');
            setDueDate(existingInvoice.due_date?.split('T')[0] || '');
            setIntroText(existingInvoice.intro_text || 'Unsere Lieferungen/Leistungen stellen wir Ihnen wie folgt in Rechnung.');
            setPaymentTerms(existingInvoice.payment_terms || 'Zahlbar sofort, rein netto');
            setFooterNote(existingInvoice.footer_note || 'Vielen Dank für die gute Zusammenarbeit.');

            if (existingInvoice.lines && existingInvoice.lines.length > 0) {
                setLines(existingInvoice.lines.map((line: any) => ({
                    description: line.description,
                    quantity: parseFloat(line.quantity) || 1,
                    unit: line.unit || 'Stück',
                    unit_price: (line.unit_price / 100) || 0, // Convert from cents
                    tax_rate: parseFloat(line.tax_rate) || 19,
                    account_id: line.account_id?.toString() || '',
                })));
            }
        }
    }, [existingInvoice]);

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

    const createInvoiceMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = isEditMode ? `/api/invoices/${id}` : '/api/invoices';
            const method = isEditMode ? 'put' : 'post';

            try {
                // @ts-ignore
                const { data: resData } = await axios[method](url, data);
                return resData;
            } catch (error: any) {
                throw new Error(error.response?.data?.message || 'Fehler beim Speichern');
            }
        },
        onSuccess: (data) => {
            navigate(`/${tenant}/invoices/${data.id}/preview`);
        },
    });

    const customers = contacts?.filter((c) => c.type === 'customer') || [];

    // Auto-fill address when customer is selected from suggestions
    const handleCustomerSelect = (contact: Contact) => {
        setCustomerName(contact.name);
        setCustomerAddress(contact.address || '');
        setOriginalContactAddress(contact.address || '');
        setSelectedContactId(contact.id);
    };

    // Auto-select revenue account based on tax rate when accounts load or when lines change (e.g. from order)
    useEffect(() => {
        if (accounts && accounts.length > 0 && lines.length > 0) {
            const hasEmptyAccountIds = lines.some(line => !line.account_id);
            if (hasEmptyAccountIds) {
                setLines(prevLines =>
                    prevLines.map(line => {
                        // Only auto-set if account_id is empty
                        if (!line.account_id) {
                            const accountCode = TAX_ACCOUNT_MAP[line.tax_rate] || TAX_ACCOUNT_MAP[19];
                            let account = accounts.find(a => a.code === accountCode);
                            if (!account) {
                                account = accounts.find(a => a.type === 'revenue' && a.code.startsWith('8'));
                            }
                            if (account) {
                                return { ...line, account_id: account.id.toString() };
                            }
                        }
                        return line;
                    })
                );
            }
        }
    }, [accounts, lines.length]);

    // Update tax rate and auto-select revenue account
    const handleTaxRateChange = (index: number, taxRate: number) => {
        const newLines = [...lines];
        newLines[index] = {
            ...newLines[index],
            tax_rate: taxRate,
        };

        // Auto-select revenue account based on tax rate
        const accountCode = TAX_ACCOUNT_MAP[taxRate];
        if (accountCode && accounts) {
            // First try exact match
            let account = accounts.find(a => a.code === accountCode);

            // If not found, try any revenue account starting with 8
            if (!account) {
                account = accounts.find(a => a.type === 'revenue' && a.code.startsWith('8'));
            }

            if (account) {
                newLines[index].account_id = account.id.toString();
            }
        }

        setLines(newLines);
    };

    const addLine = () => {
        // Find default account for 19% tax
        let defaultAccountId = '';
        if (accounts) {
            const accountCode = TAX_ACCOUNT_MAP[19];
            let account = accounts.find(a => a.code === accountCode);
            if (!account) {
                account = accounts.find(a => a.type === 'revenue' && a.code.startsWith('8'));
            }
            if (account) {
                defaultAccountId = account.id.toString();
            }
        }

        setLines([...lines, {
            product_id: null,
            description: '',
            quantity: 1,
            unit: 'Stück',
            unit_price: 0,
            tax_rate: 19,
            account_id: defaultAccountId
        }]);
    };

    const removeLine = (index: number) => {
        setLines(lines.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: keyof InvoiceLine, value: any) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLines(newLines);
    };

    const handleProductSelect = (index: number, product: Product | null) => {
        if (!product) {
            return;
        }

        const newLines = [...lines];

        // Auto-fill fields from product
        newLines[index] = {
            ...newLines[index],
            product_id: product.id,
            description: product.name,
            quantity: 1,
            unit: product.unit,
            unit_price: product.price_net / 100, // Convert from cents
            tax_rate: product.tax_rate,
        };

        // Auto-select revenue account based on tax rate
        const accountCode = TAX_ACCOUNT_MAP[product.tax_rate] || TAX_ACCOUNT_MAP[19];
        if (accountCode && accounts) {
            let account = accounts.find(a => a.code === accountCode);
            if (!account) {
                account = accounts.find(a => a.type === 'revenue' && a.code.startsWith('8'));
            }
            if (account) {
                newLines[index].account_id = account.id.toString();
            }
        }

        setLines(newLines);
    };

    const handleSubmit = async (e: React.FormEvent, saveAddressPermanently: boolean = false) => {
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
        } else {
            // Check if address was changed for existing contact
            const addressChanged = originalContactAddress !== null && customerAddress !== originalContactAddress;

            if (addressChanged && !pendingSubmitData) {
                // Store pending data and show dialog
                setPendingSubmitData({
                    contactId,
                    formattedLines: lines.map((line) => ({
                        description: line.description,
                        quantity: parseFloat(line.quantity.toString()),
                        unit: line.unit,
                        unit_price: Math.round(parseFloat(line.unit_price.toString()) * 100),
                        tax_rate: parseFloat(line.tax_rate.toString()),
                        account_id: parseInt(line.account_id),
                    })),
                });
                setAddressDialogOpen(true);
                return;
            }

            // Update contact address if user chose to save permanently
            if (saveAddressPermanently && addressChanged) {
                try {
                    await axios.put(`/api/contacts/${contactId}`, {
                        address: customerAddress,
                    });
                    queryClient.invalidateQueries({ queryKey: ['contacts'] });
                } catch (error) {
                    console.error('Fehler beim Aktualisieren der Adresse');
                }
            }
        }

        const formattedLines = pendingSubmitData?.formattedLines || lines.map((line) => ({
            product_id: line.product_id || null,
            description: line.description,
            quantity: parseFloat(line.quantity.toString()),
            unit: line.unit,
            unit_price: Math.round(parseFloat(line.unit_price.toString()) * 100),
            tax_rate: parseFloat(line.tax_rate.toString()),
            account_id: parseInt(line.account_id),
        }));

        // Clear pending data
        setPendingSubmitData(null);
        setAddressDialogOpen(false);

        createInvoiceMutation.mutate({
            contact_id: pendingSubmitData?.contactId || contactId,
            order_id: fromOrderId,
            invoice_date: invoiceDate,
            due_date: dueDate,
            intro_text: introText,
            payment_terms: paymentTerms,
            footer_note: footerNote,
            lines: formattedLines,
        });
    };

    // Handle address dialog responses
    const handleAddressDialogResponse = (savePermanently: boolean) => {
        const fakeEvent = { preventDefault: () => { } } as React.FormEvent;
        handleSubmit(fakeEvent, savePermanently);
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
            lines.every(line => line.description.trim() !== '' && line.account_id !== '');
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
                    /* Preview Mode - Show invoice preview before saving */
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
                                    Vorschau der Rechnung
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
                                            Rechnungsdatum: {new Date(invoiceDate).toLocaleDateString('de-DE')}
                                        </CardTitle>
                                        <CardDescription>
                                            Fällig am: {new Date(dueDate).toLocaleDateString('de-DE')}
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
                                            Rechnungsempfänger
                                        </h3>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                            <p className="font-semibold text-slate-900 dark:text-slate-100">{customerName}</p>
                                            <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line mt-1">{customerAddress || '-'}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                                            <Calendar className="w-4 h-4" />
                                            Rechnungsdetails
                                        </h3>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-slate-600 dark:text-slate-400">Rechnungsdatum:</span>
                                                <span className="font-medium">{new Date(invoiceDate).toLocaleDateString('de-DE')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600 dark:text-slate-400">Fällig am:</span>
                                                <span className="font-medium">{new Date(dueDate).toLocaleDateString('de-DE')}</span>
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
                                <Link to={`/${tenant}/invoices`}>
                                    <Button variant="ghost" className="gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                                        <X className="w-4 h-4" />
                                        Verwerfen
                                    </Button>
                                </Link>
                                <Button
                                    onClick={() => handleSubmit({ preventDefault: () => { } } as React.FormEvent)}
                                    disabled={createInvoiceMutation.isPending || createContactMutation.isPending}
                                    className="gap-2 shadow-lg shadow-emerald-100/20 hover:shadow-emerald-200/30 transition-all duration-300 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                                >
                                    <Save className="w-4 h-4" />
                                    {createInvoiceMutation.isPending ? 'Speichere...' : 'Rechnung erstellen'}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Edit Mode - Show the form */
                    <>
                        <div className="flex items-center gap-4">
                            <Link to={`/${tenant}/invoices`}>
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {isEditMode ? 'Rechnung bearbeiten' : 'Neue Rechnung'}
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                    {isEditMode ? 'Bearbeite die Rechnungsdaten' : 'Erstelle eine neue Ausgangsrechnung'}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Info when creating from order */}
                            {sourceOrder && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                    <p className="text-blue-700 dark:text-blue-300 text-sm">
                                        <strong>Hinweis:</strong> Diese Rechnung wird aus Auftrag <strong>{sourceOrder.order_number}</strong> erstellt.
                                        Die Positionen wurden automatisch übernommen. Bitte prüfen Sie die Daten und wählen Sie die Erlöskonten aus.
                                    </p>
                                </div>
                            )}
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
                                                            className="px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between"
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

                            {/* Invoice Details */}
                            <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-primary" />
                                        Rechnungsdetails
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                Rechnungsdatum *
                                            </label>
                                            <Input
                                                type="date"
                                                value={invoiceDate}
                                                onChange={(e) => setInvoiceDate(e.target.value)}
                                                required
                                                className="bg-white dark:bg-slate-950"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                                Fälligkeitsdatum *
                                            </label>
                                            <Input
                                                type="date"
                                                value={dueDate}
                                                onChange={(e) => setDueDate(e.target.value)}
                                                required
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
                                            placeholder="Unsere Lieferungen/Leistungen stellen wir Ihnen wie folgt in Rechnung."
                                            className="bg-white dark:bg-slate-950 resize-none"
                                        />
                                    </div>
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
                                                <div className="col-span-12 md:col-span-4">
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                        Produkt *
                                                    </label>
                                                    <ProductSelector
                                                        value={line.product_id}
                                                        onChange={(product) => handleProductSelect(index, product)}
                                                    />
                                                    {line.description && line.product_id && (
                                                        <p className="text-xs text-gray-500 mt-1">{line.description}</p>
                                                    )}
                                                </div>
                                                <div className="col-span-6 md:col-span-1">
                                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                        Menge *
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={line.quantity}
                                                        onChange={(e) =>
                                                            updateLine(index, 'quantity', parseFloat(e.target.value))
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
                                                        onValueChange={(value) => handleTaxRateChange(index, parseFloat(value))}
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
                                        <CreditCard className="w-5 h-5 text-primary" />
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
                                            placeholder="Vielen Dank für die gute Zusammenarbeit."
                                            className="bg-white dark:bg-slate-950 resize-none"
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <Link to={`/${tenant}/invoices`}>
                                    <Button type="button" variant="outline" className="gap-2">
                                        <X className="w-4 h-4" />
                                        Abbrechen
                                    </Button>
                                </Link>
                                {isEditMode ? (
                                    <Button
                                        type="submit"
                                        disabled={createInvoiceMutation.isPending || createContactMutation.isPending}
                                        className="gap-2 shadow-lg shadow-indigo-100/20 hover:shadow-indigo-200/30 transition-all duration-300 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700"
                                    >
                                        <Save className="w-4 h-4" />
                                        {createInvoiceMutation.isPending ? 'Speichere...' : 'Änderungen speichern'}
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            if (canShowPreview()) {
                                                setShowPreview(true);
                                            } else {
                                                alert('Bitte füllen Sie alle Pflichtfelder aus (Kunde, Beschreibung, Konto).');
                                            }
                                        }}
                                        className="gap-2 shadow-lg shadow-indigo-100/20 hover:shadow-indigo-200/30 transition-all duration-300 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Vorschau anzeigen
                                    </Button>
                                )}
                            </div>
                        </form>
                    </>
                )}

                {/* Address Change Dialog */}
                <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Adresse geändert</DialogTitle>
                            <DialogDescription>
                                Die Adresse wurde geändert. Möchten Sie die neue Adresse dauerhaft beim Kunden speichern?
                            </DialogDescription>
                        </DialogHeader>
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-md text-sm">
                            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Neue Adresse:</p>
                            <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line">{customerAddress}</p>
                        </div>
                        <DialogFooter className="flex gap-2 sm:gap-0">
                            <Button
                                variant="outline"
                                onClick={() => handleAddressDialogResponse(false)}
                            >
                                Nur für diese Rechnung
                            </Button>
                            <Button
                                onClick={() => handleAddressDialogResponse(true)}
                                className="bg-gradient-to-r from-indigo-600 to-cyan-600"
                            >
                                Dauerhaft speichern
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
