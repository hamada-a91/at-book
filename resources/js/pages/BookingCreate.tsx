import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Plus, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ContactSelector } from '@/components/ContactSelector';
import { AccountSelector } from '@/components/AccountSelector';
import { roundToTwoDecimals, formatCurrency as formatEuro, calculateVAT } from '@/lib/currency';

interface Account {
    id: number;
    code: string;
    name: string;
    type: string;
}

interface Contact {
    id: number;
    name: string;
    type: 'customer' | 'vendor';
    account_id?: number;
}

const bookingSchema = z.object({
    date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Ungültiges Datum'),
    description: z.string().min(3, 'Beschreibung ist erforderlich'),
    contact_id: z.string().optional(),
    lines: z
        .array(
            z.object({
                account_id: z.string().min(1, 'Konto ist erforderlich'),
                type: z.enum(['debit', 'credit']),
                amount: z.coerce.number().min(0.01, 'Betrag muss positiv sein'),
            })
        )
        .min(2, 'Mindestens 2 Zeilen erforderlich')
        .refine(
            (lines) => {
                const debit = lines.filter((l) => l.type === 'debit').reduce((sum, l) => sum + l.amount, 0);
                const credit = lines.filter((l) => l.type === 'credit').reduce((sum, l) => sum + l.amount, 0);
                return Math.abs(debit - credit) < 0.01;
            },
            { message: 'Buchung muss ausgeglichen sein (Soll = Haben)' }
        ),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export function BookingCreate() {
    const navigate = useNavigate();

    // Quick Entry State with Direct Payment Option
    const [quickEntry, setQuickEntry] = useState({
        contact_id: '',
        contra_account_id: '',
        vat_rate: '19',
        gross_amount: '',
        is_paid: false,
        payment_account_id: '',
    });

    const { data: accounts } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => {
            const res = await fetch('/api/accounts');
            return res.json();
        },
    });

    const { data: contacts } = useQuery<Contact[]>({
        queryKey: ['contacts'],
        queryFn: async () => {
            const res = await fetch('/api/contacts');
            return res.json();
        },
    });

    const form = useForm<BookingFormValues>({
        resolver: zodResolver(bookingSchema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            description: '',
            contact_id: 'none',
            lines: [
                { account_id: '', type: 'debit', amount: 0 },
                { account_id: '', type: 'credit', amount: 0 },
            ],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'lines',
    });

    const createMutation = useMutation({
        mutationFn: async (data: BookingFormValues) => {
            const payload = {
                date: data.date,
                description: data.description,
                contact_id: data.contact_id === 'none' || !data.contact_id ? null : data.contact_id,
                lines: data.lines.map((line) => ({
                    account_id: parseInt(line.account_id),
                    type: line.type,
                    amount: Math.round(line.amount * 100), // Convert to cents
                    tax_key: null,
                    tax_amount: 0,
                })),
            };

            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Fehler beim Erstellen');
            }

            return res.json();
        },
        onSuccess: () => {
            navigate('/bookings');
        },
        onError: (error: Error) => {
            alert('Fehler: ' + error.message);
        },
    });

    const onSubmit = (data: BookingFormValues) => {
        createMutation.mutate(data);
    };

    const debitSum = form.watch('lines').filter((l) => l.type === 'debit').reduce((sum, l) => sum + (parseFloat(String(l.amount)) || 0), 0);
    const creditSum = form.watch('lines').filter((l) => l.type === 'credit').reduce((sum, l) => sum + (parseFloat(String(l.amount)) || 0), 0);
    const isBalanced = Math.abs(debitSum - creditSum) < 0.01 && debitSum > 0;

    // Quick Entry Handler with All Improvements
    const handleQuickEntry = () => {
        const { contact_id, contra_account_id, vat_rate, gross_amount, is_paid, payment_account_id } = quickEntry;

        // Validation
        if (!contact_id || !contra_account_id || !gross_amount) {
            alert('Bitte füllen Sie alle Pflichtfelder aus.');
            return;
        }

        if (is_paid && !payment_account_id) {
            alert('Bitte wählen Sie ein Zahlungskonto (Kasse/Bank).');
            return;
        }

        const selectedContact = contacts?.find(c => String(c.id) === contact_id);
        if (!selectedContact || !selectedContact.account_id) {
            alert('Kontakt hat kein zugeordnetes Konto.');
            return;
        }

        const grossNum = parseFloat(gross_amount);
        if (isNaN(grossNum) || grossNum <= 0) {
            alert('Ungültiger Bruttobetrag.');
            return;
        }

        // Calculate VAT with proper rounding
        const { gross, net, tax } = calculateVAT(grossNum, parseFloat(vat_rate));

        // Find VAT account by CODE (more reliable than hardcoded IDs)
        let vatAccount: Account | undefined;
        if (parseFloat(vat_rate) > 0) {
            const vatCode = selectedContact.type === 'customer'
                ? (vat_rate === '19' ? '1776' : '1771') // Umsatzsteuer
                : (vat_rate === '19' ? '1576' : '1571'); // Vorsteuer
            vatAccount = accounts?.find(acc => acc.code === vatCode);
        }

        // Generate booking lines
        const newLines = [];

        if (is_paid) {
            // PAID VERSION: Include payment account
            if (selectedContact.type === 'customer') {
                // Customer Sale WITH Payment: Debit Cash/Bank, Credit Revenue, Credit VAT
                newLines.push({
                    account_id: payment_account_id,
                    type: 'debit' as const,
                    amount: gross,
                });
                newLines.push({
                    account_id: contra_account_id,
                    type: 'credit' as const,
                    amount: net,
                });
                if (vatAccount && tax > 0) {
                    newLines.push({
                        account_id: String(vatAccount.id),
                        type: 'credit' as const,
                        amount: tax,
                    });
                }
            } else {
                // Vendor Purchase WITH Payment: Credit Cash/Bank, Debit Expense, Debit Input VAT
                newLines.push({
                    account_id: payment_account_id,
                    type: 'credit' as const,
                    amount: gross,
                });
                newLines.push({
                    account_id: contra_account_id,
                    type: 'debit' as const,
                    amount: net,
                });
                if (vatAccount && tax > 0) {
                    newLines.push({
                        account_id: String(vatAccount.id),
                        type: 'debit' as const,
                        amount: tax,
                    });
                }
            }
        } else {
            // UNPAID VERSION: Contact account instead of cash/bank
            if (selectedContact.type === 'customer') {
                // Customer Sale: Debit Customer, Credit Revenue, Credit VAT
                newLines.push({
                    account_id: String(selectedContact.account_id),
                    type: 'debit' as const,
                    amount: gross,
                });
                newLines.push({
                    account_id: contra_account_id,
                    type: 'credit' as const,
                    amount: net,
                });
                if (vatAccount && tax > 0) {
                    newLines.push({
                        account_id: String(vatAccount.id),
                        type: 'credit' as const,
                        amount: tax,
                    });
                }
            } else {
                // Vendor Purchase: Credit Vendor, Debit Expense, Debit Input VAT
                newLines.push({
                    account_id: String(selectedContact.account_id),
                    type: 'credit' as const,
                    amount: gross,
                });
                newLines.push({
                    account_id: contra_account_id,
                    type: 'debit' as const,
                    amount: net,
                });
                if (vatAccount && tax > 0) {
                    newLines.push({
                        account_id: String(vatAccount.id),
                        type: 'debit' as const,
                        amount: tax,
                    });
                }
            }
        }

        // Update form
        form.setValue('lines', newLines);
        form.setValue('contact_id', contact_id);

        // Auto-generate description if empty
        if (!form.getValues('description')) {
            const accountName = accounts?.find(a => String(a.id) === contra_account_id)?.name || '';
            const paymentText = is_paid ? 'Bezahlt - ' : '';
            form.setValue('description', `${paymentText}${selectedContact.type === 'customer' ? 'Verkauf' : 'Einkauf'} - ${selectedContact.name} - ${accountName}`);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="container mx-auto py-8 px-4">
                {/* Header */}
                <div className="mb-6">
                    <Link to="/" className="text-blue-600 hover:underline mb-2 inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Zurück zum Dashboard
                    </Link>
                    <h1 className="text-4xl font-bold text-slate-900">Neue Buchung</h1>
                    <p className="text-slate-600">Buchungssatz erstellen (Doppelte Buchführung)</p>
                </div>

                {/* Form */}
                <Card className="shadow-lg">
                    <CardContent className="p-6">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                {/* Header Data */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="date"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Datum *</FormLabel>
                                                <FormControl>
                                                    <Input type="date" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Beschreibung *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="z.B. Büromaterial Einkauf" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="contact_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Kontakt (Optional)</FormLabel>
                                                <FormControl>
                                                    <ContactSelector
                                                        contacts={contacts}
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Quick Entry Section */}
                                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Zap className="w-5 h-5 text-blue-600" />
                                            <h3 className="text-lg font-semibold text-blue-900">Schnelleingabe</h3>
                                            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">Neu!</span>
                                        </div>
                                        <p className="text-sm text-slate-600 mb-4">
                                            Geben Sie Kontakt, Gegenkonto, MwSt und Bruttobetrag ein. Die Buchungszeilen werden automatisch generiert.
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                                            {/* Contact */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    Kontakt *
                                                </label>
                                                <ContactSelector
                                                    contacts={contacts}
                                                    value={quickEntry.contact_id}
                                                    onChange={(value) => setQuickEntry(prev => ({ ...prev, contact_id: value }))}
                                                />
                                            </div>

                                            {/* Contra Account */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    Gegenkonto (Erlös/Aufwand) *
                                                </label>
                                                <AccountSelector
                                                    accounts={accounts}
                                                    value={quickEntry.contra_account_id}
                                                    onChange={(value) => setQuickEntry(prev => ({ ...prev, contra_account_id: value }))}
                                                    filterType={['revenue', 'expense']}
                                                    placeholder="Erlös-/Aufwandskonto..."
                                                />
                                            </div>

                                            {/* VAT Rate */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    MwSt-Satz *
                                                </label>
                                                <Select
                                                    value={quickEntry.vat_rate}
                                                    onValueChange={(value) => setQuickEntry(prev => ({ ...prev, vat_rate: value }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="19">19%</SelectItem>
                                                        <SelectItem value="7">7%</SelectItem>
                                                        <SelectItem value="0">0% (Steuerfrei)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Gross Amount */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    Bruttobetrag (€) *
                                                </label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="119.00"
                                                    value={quickEntry.gross_amount}
                                                    onChange={(e) => setQuickEntry(prev => ({ ...prev, gross_amount: e.target.value }))}
                                                />
                                            </div>

                                            {/* Payment Option */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    Zahlung
                                                </label>
                                                <div className="flex items-center space-x-2 h-10">
                                                    <Checkbox
                                                        id="is_paid"
                                                        checked={quickEntry.is_paid}
                                                        onCheckedChange={(checked) => setQuickEntry(prev => ({ ...prev, is_paid: !!checked }))}
                                                    />
                                                    <label
                                                        htmlFor="is_paid"
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                    >
                                                        Direkt bezahlt?
                                                    </label>
                                                </div>
                                                {quickEntry.is_paid && (
                                                    <div className="mt-2">
                                                        <AccountSelector
                                                            accounts={accounts}
                                                            value={quickEntry.payment_account_id}
                                                            onChange={(value) => setQuickEntry(prev => ({ ...prev, payment_account_id: value }))}
                                                            filterType={['asset']}
                                                            placeholder="Kasse/Bank..."
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Auto-Fill Button */}
                                            <div className="flex items-end">
                                                <Button
                                                    type="button"
                                                    onClick={handleQuickEntry}
                                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                                >
                                                    <Zap className="w-4 h-4 mr-2" />
                                                    Ausfüllen
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Lines */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-medium">Buchungszeilen</h3>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => append({ account_id: '', type: 'debit', amount: 0 })}
                                        >
                                            <Plus className="w-4 h-4 mr-2" /> Zeile hinzufügen
                                        </Button>
                                    </div>

                                    {fields.map((field, index) => (
                                        <div key={field.id} className="grid grid-cols-12 gap-3 p-4 bg-slate-50 rounded-lg">
                                            {/* Account */}
                                            <div className="col-span-5">
                                                <FormField
                                                    control={form.control}
                                                    name={`lines.${index}.account_id`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Konto</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Konto wählen..." />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {accounts?.map((acc) => (
                                                                        <SelectItem key={acc.id} value={String(acc.id)}>
                                                                            {acc.code} - {acc.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            {/* Type */}
                                            <div className="col-span-2">
                                                <FormField
                                                    control={form.control}
                                                    name={`lines.${index}.type`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Typ</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="debit">Soll</SelectItem>
                                                                    <SelectItem value="credit">Haben</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            {/* Amount with Rounding */}
                                            <div className="col-span-3">
                                                <FormField
                                                    control={form.control}
                                                    name={`lines.${index}.amount`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Betrag (€)</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    {...field}
                                                                    value={field.value ? roundToTwoDecimals(parseFloat(String(field.value))) : ''}
                                                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            {/* Delete */}
                                            <div className="col-span-2 flex items-end">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => remove(index)}
                                                    disabled={fields.length <= 2}
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}

                                    {form.formState.errors.lines?.root && (
                                        <p className="text-red-500 text-sm font-medium">{form.formState.errors.lines.root.message}</p>
                                    )}
                                </div>

                                {/* Balance Check with Formatted Currency */}
                                <div className={`p-4 rounded-lg ${isBalanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <span className="font-medium text-slate-700">Soll:</span>
                                            <span className="ml-2 font-bold">{formatEuro(debitSum)}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-slate-700">Haben:</span>
                                            <span className="ml-2 font-bold">{formatEuro(creditSum)}</span>
                                        </div>
                                        <div>
                                            <span className={`font-medium ${isBalanced ? 'text-green-700' : 'text-red-700'}`}>
                                                {isBalanced ? '✓ Ausgeglichen' : '✗ Nicht ausgeglichen'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Submit */}
                                <div className="flex gap-3">
                                    <Button type="submit" disabled={!isBalanced || createMutation.isPending} className="flex-1">
                                        {createMutation.isPending ? 'Wird gespeichert...' : 'Buchung speichern (Entwurf)'}
                                    </Button>
                                    <Link to="/" className="flex-1">
                                        <Button type="button" variant="outline" className="w-full">
                                            Abbrechen
                                        </Button>
                                    </Link>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
