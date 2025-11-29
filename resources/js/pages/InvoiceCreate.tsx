import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Layout/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, UserPlus } from 'lucide-react';

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
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    tax_rate: number;
    account_id: string;
}

// Tax rate to revenue account mapping
const TAX_ACCOUNT_MAP: Record<number, string> = {
    19: '8400', // Erlöse 19% USt
    7: '8300',  // Erlöse 7% USt  
    0: '8100',  // Erlöse steuerfrei
};

export function InvoiceCreate() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [customerName, setCustomerName] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
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

    const { data: contacts } = useQuery<Contact[]>({
        queryKey: ['contacts'],
        queryFn: async () => {
            const res = await fetch('/api/contacts');
            return res.json();
        },
    });

    const { data: accounts } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => {
            const res = await fetch('/api/accounts');
            return res.json();
        },
    });

    const createContactMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Fehler beim Erstellen des Kunden');
            return res.json();
        },
        onSuccess: (newContact) => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            setSelectedContactId(newContact.id);
        },
    });

    const createInvoiceMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Fehler beim Erstellen');
            }
            return res.json();
        },
        onSuccess: (data) => {
            navigate(`/invoices/${data.id}/preview`);
        },
    });

    const customers = contacts?.filter((c) => c.type === 'customer') || [];

    // Auto-fill address when customer is selected from suggestions
    const handleCustomerSelect = (contact: Contact) => {
        setCustomerName(contact.name);
        setCustomerAddress(contact.address || '');
        setSelectedContactId(contact.id);
    };

    // Auto-select revenue account for default 19% tax rate when accounts load
    useEffect(() => {
        if (accounts && accounts.length > 0) {
            setLines(prevLines =>
                prevLines.map(line => {
                    // Only auto-set if account_id is empty and tax_rate is default (19)
                    if (!line.account_id && line.tax_rate === 19) {
                        const accountCode = TAX_ACCOUNT_MAP[19];
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
    }, [accounts]);

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
            account_id: parseInt(line.account_id),
        }));

        createInvoiceMutation.mutate({
            contact_id: contactId,
            invoice_date: invoiceDate,
            due_date: dueDate,
            intro_text: introText,
            payment_terms: paymentTerms,
            footer_note: footerNote,
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

    // Filter customers for autocomplete
    const filteredCustomers = customerName
        ? customers.filter((c) =>
            c.name.toLowerCase().includes(customerName.toLowerCase())
        )
        : [];

    return (
        <Navigation>
            <div className="space-y-6">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900">Neue Rechnung</h1>
                    <p className="text-slate-600">Erstelle eine neue Ausgangsrechnung</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Customer Info */}
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Kundeninformationen</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
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
                                    />
                                    {/* Autocomplete dropdown */}
                                    {customerName && filteredCustomers.length > 0 && !selectedContactId && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                                            {filteredCustomers.map((contact) => (
                                                <button
                                                    key={contact.id}
                                                    type="button"
                                                    onClick={() => handleCustomerSelect(contact)}
                                                    className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center justify-between"
                                                >
                                                    <span>{contact.name}</span>
                                                    <span className="text-xs text-slate-500">Vorhanden</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {selectedContactId && (
                                        <p className="text-xs text-green-600 mt-1">✓ Kunde ausgewählt</p>
                                    )}
                                    {customerName && !selectedContactId && filteredCustomers.length === 0 && (
                                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                            <UserPlus className="w-3 h-3" />
                                            Neuer Kunde wird erstellt
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Adresse
                                    </label>
                                    <Textarea
                                        value={customerAddress}
                                        onChange={(e) => setCustomerAddress(e.target.value)}
                                        placeholder="Straße, PLZ Stadt"
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Invoice Details */}
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Rechnungsdetails</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Rechnungsdatum *
                                    </label>
                                    <Input
                                        type="date"
                                        value={invoiceDate}
                                        onChange={(e) => setInvoiceDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Fälligkeitsdatum *
                                    </label>
                                    <Input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Line Items */}
                    <Card className="shadow-lg">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Positionen</CardTitle>
                                <Button type="button" size="sm" onClick={addLine}>
                                    <Plus className="w-4 h-4 mr-1" />
                                    Position hinzufügen
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {lines.map((line, index) => (
                                    <div
                                        key={index}
                                        className="grid grid-cols-12 gap-4 p-4 bg-slate-50 rounded-lg"
                                    >
                                        <div className="col-span-3">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Beschreibung *
                                            </label>
                                            <Input
                                                value={line.description}
                                                onChange={(e) => updateLine(index, 'description', e.target.value)}
                                                required
                                                placeholder="Leistung/Artikel"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
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
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Einheit *
                                            </label>
                                            <Select
                                                value={line.unit}
                                                onValueChange={(value) => updateLine(index, 'unit', value)}
                                            >
                                                <SelectTrigger>
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
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
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
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                USt. % *
                                            </label>
                                            <Select
                                                value={line.tax_rate.toString()}
                                                onValueChange={(value) => handleTaxRateChange(index, parseFloat(value))}
                                                defaultValue="19"
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="19% USt." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="19">19% USt.</SelectItem>
                                                    <SelectItem value="7">7% USt.</SelectItem>
                                                    <SelectItem value="0">0% (steuerfrei)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-1 flex items-center justify-center pt-6">
                                            <span className="text-sm font-semibold">
                                                {(line.quantity * line.unit_price * (1 + line.tax_rate / 100)).toFixed(2)} €
                                            </span>
                                        </div>
                                        <div className="col-span-1 flex items-end">
                                            {lines.length > 1 && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => removeLine(index)}
                                                    className="w-full"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-600" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Total */}
                            <div className="mt-6 flex justify-end">
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <div className="text-sm text-slate-600">Gesamtsumme (inkl. MwSt)</div>
                                    <div className="text-2xl font-bold text-blue-900">
                                        {calculateTotal().toFixed(2)} €
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Footer Section */}
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Fußbereich (optional)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Einleitungstext
                                </label>
                                <Textarea
                                    value={introText}
                                    onChange={(e) => setIntroText(e.target.value)}
                                    rows={2}
                                    placeholder="Unsere Lieferungen/Leistungen stellen wir Ihnen wie folgt in Rechnung."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Zahlungsbedingung
                                </label>
                                <Input
                                    value={paymentTerms}
                                    onChange={(e) => setPaymentTerms(e.target.value)}
                                    placeholder="Zahlbar sofort, rein netto"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Nachbemerkung
                                </label>
                                <Textarea
                                    value={footerNote}
                                    onChange={(e) => setFooterNote(e.target.value)}
                                    rows={2}
                                    placeholder="Vielen Dank für die gute Zusammenarbeit."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>
                            Abbrechen
                        </Button>
                        <Button type="submit" disabled={createInvoiceMutation.isPending || createContactMutation.isPending}>
                            {createInvoiceMutation.isPending || createContactMutation.isPending ? 'Erstelle...' : 'Rechnung erstellen'}
                        </Button>
                    </div>
                </form>
            </div>
        </Navigation>
    );
}
