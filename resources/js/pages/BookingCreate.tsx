import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Plus, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

        // ========================================
        // WICHTIG: Bei "Direkt bezahlt" = 5 ZEILEN!
        // ========================================
        if (is_paid) {
            // *** PAID: 5 LINES (Invoice 3 + Payment 2) ***

            if (selectedContact.type === 'customer') {
                // === SCHRITT 1: RECHNUNG (3 Zeilen) ===

                // Zeile 1: Soll Debitor 119€
                newLines.push({
                    account_id: String(selectedContact.account_id),
                    type: 'debit' as const,
                    amount: gross,
                });

                // Zeile 2: Haben Erlöse 100€
                newLines.push({
                    account_id: contra_account_id,
                    type: 'credit' as const,
                    amount: net,
                });

                // Zeile 3: Haben USt 19€
                if (vatAccount && tax > 0) {
                    newLines.push({
                        account_id: String(vatAccount.id),
                        type: 'credit' as const,
                        amount: tax,
                    });
                }

                // === SCHRITT 2: ZAHLUNG (2 Zeilen) ===

                // Zeile 4: Soll Kasse 119€
                newLines.push({
                    account_id: payment_account_id,
                    type: 'debit' as const,
                    amount: gross,
                });

                // Zeile 5: Haben Debitor 119€
                newLines.push({
                    account_id: String(selectedContact.account_id),
                    type: 'credit' as const,
                    amount: gross,
                });

            } else {
                // === VENDOR: SCHRITT 1: RECHNUNG (3 Zeilen) ===

                // Zeile 1: Haben Kreditor
                newLines.push({
                    account_id: String(selectedContact.account_id),
                    type: 'credit' as const,
                    amount: gross,
                });

                // Zeile 2: Soll Aufwand
                newLines.push({
                    account_id: contra_account_id,
                    type: 'debit' as const,
                    amount: net,
                });

                // Zeile 3: Soll Vorsteuer
                if (vatAccount && tax > 0) {
                    newLines.push({
                        account_id: String(vatAccount.id),
                        type: 'debit' as const,
                        amount: tax,
                    });
                }

                // === SCHRITT 2: ZAHLUNG (2 Zeilen) ===

                // Zeile 4: Haben Kasse/Bank
                newLines.push({
                    account_id: payment_account_id,
                    type: 'credit' as const,
                    amount: gross,
                });

                // Zeile 5: Soll Kreditor
                newLines.push({
                    account_id: String(selectedContact.account_id),
                    type: 'debit' as const,
                    amount: gross,
                });
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Neue Buchung</h1>
                    <p className="text-slate-500 dark:text-slate-400">Erstellen Sie einen neuen Buchungssatz</p>
                </div>
                <Button variant="ghost" onClick={() => navigate('/bookings')} className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Zurück zur Übersicht
                </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                {/* Main Form Area */}
                <div className="lg:col-span-12 space-y-6">
                    {/* Quick Entry Card */}
                    <Card className="border-none shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 dark:border dark:border-blue-900/50">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                                    <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg text-blue-900 dark:text-blue-100">Schnelleingabe</CardTitle>
                                    <CardDescription className="text-blue-700 dark:text-blue-300">
                                        Automatische Generierung von Buchungssätzen
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                                <div className="lg:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                        Kontakt *
                                    </label>
                                    <ContactSelector
                                        contacts={contacts}
                                        value={quickEntry.contact_id}
                                        onChange={(value) => setQuickEntry(prev => ({ ...prev, contact_id: value }))}
                                    />
                                </div>

                                <div className="lg:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                        Gegenkonto *
                                    </label>
                                    <AccountSelector
                                        accounts={accounts}
                                        value={quickEntry.contra_account_id}
                                        onChange={(value) => setQuickEntry(prev => ({ ...prev, contra_account_id: value }))}
                                        filterType={['revenue', 'expense']}
                                        placeholder="Erlös-/Aufwandskonto..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                        MwSt *
                                    </label>
                                    <Select
                                        value={quickEntry.vat_rate}
                                        onValueChange={(value) => setQuickEntry(prev => ({ ...prev, vat_rate: value }))}
                                    >
                                        <SelectTrigger className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="19">19%</SelectItem>
                                            <SelectItem value="7">7%</SelectItem>
                                            <SelectItem value="0">0%</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                        Betrag (€) *
                                    </label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={quickEntry.gross_amount}
                                        onChange={(e) => setQuickEntry(prev => ({ ...prev, gross_amount: e.target.value }))}
                                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                                    />
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="is_paid"
                                        checked={quickEntry.is_paid}
                                        onCheckedChange={(checked) => setQuickEntry(prev => ({ ...prev, is_paid: !!checked }))}
                                        className="border-blue-400 data-[state=checked]:bg-blue-600"
                                    />
                                    <label
                                        htmlFor="is_paid"
                                        className="text-sm font-medium leading-none text-slate-700 dark:text-slate-300 cursor-pointer"
                                    >
                                        Als "Bezahlt" markieren
                                    </label>
                                    {quickEntry.is_paid && (
                                        <div className="w-[200px] ml-4">
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
                                <Button
                                    type="button"
                                    onClick={handleQuickEntry}
                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                >
                                    <Zap className="w-4 h-4 mr-2" />
                                    Übernehmen
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Manual Entry Form */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Buchungsdetails</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                    {/* Header Data */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="date"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-slate-700 dark:text-slate-300">Datum *</FormLabel>
                                                    <FormControl>
                                                        <Input type="date" {...field} className="bg-white dark:bg-slate-950" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem className="md:col-span-2">
                                                    <FormLabel className="text-slate-700 dark:text-slate-300">Beschreibung *</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="z.B. Büromaterial Einkauf bei Müller" {...field} className="bg-white dark:bg-slate-950" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {/* Lines */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Buchungszeilen</h3>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => append({ account_id: '', type: 'debit', amount: 0 })}
                                                className="bg-white dark:bg-slate-950"
                                            >
                                                <Plus className="w-4 h-4 mr-2" /> Zeile hinzufügen
                                            </Button>
                                        </div>

                                        <div className="space-y-3">
                                            {fields.map((field, index) => (
                                                <div key={field.id} className="group relative grid grid-cols-12 gap-4 p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                                                    {/* Account */}
                                                    <div className="col-span-12 md:col-span-5">
                                                        <FormField
                                                            control={form.control}
                                                            name={`lines.${index}.account_id`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs text-slate-500 dark:text-slate-400">Konto</FormLabel>
                                                                    <FormControl>
                                                                        <AccountSelector
                                                                            accounts={accounts}
                                                                            value={field.value}
                                                                            onChange={field.onChange}
                                                                            placeholder="Konto wählen..."
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>

                                                    {/* Type */}
                                                    <div className="col-span-6 md:col-span-3">
                                                        <FormField
                                                            control={form.control}
                                                            name={`lines.${index}.type`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs text-slate-500 dark:text-slate-400">Typ</FormLabel>
                                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                                        <FormControl>
                                                                            <SelectTrigger className={`h-10 ${field.value === 'debit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} bg-white dark:bg-slate-950`}>
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            <SelectItem value="debit" className="text-emerald-600">Soll</SelectItem>
                                                                            <SelectItem value="credit" className="text-rose-600">Haben</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>

                                                    {/* Amount */}
                                                    <div className="col-span-6 md:col-span-3">
                                                        <FormField
                                                            control={form.control}
                                                            name={`lines.${index}.amount`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs text-slate-500 dark:text-slate-400">Betrag (€)</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="number"
                                                                            step="0.01"
                                                                            {...field}
                                                                            value={field.value ? roundToTwoDecimals(parseFloat(String(field.value))) : ''}
                                                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                                            className="h-10 font-mono text-right bg-white dark:bg-slate-950"
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>

                                                    {/* Delete */}
                                                    <div className="col-span-12 md:col-span-1 flex items-end justify-end pb-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => remove(index)}
                                                            disabled={fields.length <= 2}
                                                            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {form.formState.errors.lines?.root && (
                                            <p className="text-rose-500 text-sm font-medium">{form.formState.errors.lines.root.message}</p>
                                        )}
                                    </div>

                                    {/* Footer Actions */}
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                                        {/* Balance Indicator */}
                                        <div className={`flex items-center gap-6 px-4 py-2 rounded-full ${isBalanced ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'}`}>
                                            <div className="text-sm">
                                                <span className="opacity-70 mr-2">Soll:</span>
                                                <span className="font-mono font-bold">{formatEuro(debitSum)}</span>
                                            </div>
                                            <div className="h-4 w-px bg-current opacity-20" />
                                            <div className="text-sm">
                                                <span className="opacity-70 mr-2">Haben:</span>
                                                <span className="font-mono font-bold">{formatEuro(creditSum)}</span>
                                            </div>
                                            <div className="h-4 w-px bg-current opacity-20" />
                                            <div className="text-sm font-medium flex items-center gap-1.5">
                                                {isBalanced ? (
                                                    <><span>✓</span> Ausgeglichen</>
                                                ) : (
                                                    <><span>!</span> Differenz: {formatEuro(Math.abs(debitSum - creditSum))}</>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 w-full md:w-auto">
                                            <Button type="button" variant="outline" onClick={() => navigate('/bookings')} className="flex-1 md:flex-none">
                                                Abbrechen
                                            </Button>
                                            <Button type="submit" disabled={!isBalanced || createMutation.isPending} className="flex-1 md:flex-none min-w-[140px]">
                                                {createMutation.isPending ? 'Speichert...' : 'Buchung speichern'}
                                            </Button>
                                        </div>
                                    </div>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
