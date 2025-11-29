import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Layout/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

interface Contact {
    id: number;
    name: string;
    type: string;
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
    unit_price: number;
    tax_rate: number;
    account_id: string;
}

export function InvoiceCreate() {
    const navigate = useNavigate();
    const [contactId, setContactId] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [lines, setLines] = useState<InvoiceLine[]>([
        { description: '', quantity: 1, unit_price: 0, tax_rate: 19, account_id: '' },
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

    const createMutation = useMutation({
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
        onSuccess: () => {
            navigate('/invoices');
        },
    });

    const revenueAccounts = accounts?.filter((a) => a.type === 'revenue') || [];
    const customers = contacts?.filter((c) => c.type === 'customer') || [];

    const addLine = () => {
        setLines([...lines, { description: '', quantity: 1, unit_price: 0, tax_rate: 19, account_id: '' }]);
    };

    const removeLine = (index: number) => {
        setLines(lines.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: keyof InvoiceLine, value: any) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLines(newLines);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const formattedLines = lines.map((line) => ({
            description: line.description,
            quantity: parseFloat(line.quantity.toString()),
            unit_price: Math.round(parseFloat(line.unit_price.toString()) * 100), // convert to cents
            tax_rate: parseFloat(line.tax_rate.toString()),
            account_id: parseInt(line.account_id),
        }));

        createMutation.mutate({
            contact_id: parseInt(contactId),
            invoice_date: invoiceDate,
            due_date: dueDate,
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

    return (
        <Navigation>
            <div className="space-y-6">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900">Neue Rechnung</h1>
                    <p className="text-slate-600">Erstelle eine neue Ausgangsrechnung</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Header Info */}
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Rechnungsdetails</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Kunde *
                                    </label>
                                    <Select value={contactId} onValueChange={setContactId} required>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Kunde wählen..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customers?.map((contact) => (
                                                <SelectItem key={contact.id} value={contact.id.toString()}>
                                                    {contact.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
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
                                        <div className="col-span-4">
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
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Erlöskonto *
                                            </label>
                                            <Select
                                                value={line.account_id}
                                                onValueChange={(value) => updateLine(index, 'account_id', value)}
                                                required
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Konto..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {revenueAccounts.map((acc) => (
                                                        <SelectItem key={acc.id} value={acc.id.toString()}>
                                                            {acc.code} - {acc.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Menge
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
                                                Einzelpreis (€)
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
                                        <div className="col-span-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                MwSt %
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={line.tax_rate}
                                                onChange={(e) =>
                                                    updateLine(index, 'tax_rate', parseFloat(e.target.value))
                                                }
                                                required
                                            />
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

                    {/* Actions */}
                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>
                            Abbrechen
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Erstelle...' : 'Rechnung erstellen'}
                        </Button>
                    </div>
                </form>
            </div>
        </Navigation>
    );
}
