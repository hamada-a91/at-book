import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
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

interface Account {
    id: number;
    code: string;
    name: string;
}

interface Contact {
    id: number;
    name: string;
    type: 'customer' | 'vendor';
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
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
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Kontakt wählen..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="none">Kein Kontakt</SelectItem>
                                                        {contacts?.map((contact) => (
                                                            <SelectItem key={contact.id} value={String(contact.id)}>
                                                                {contact.name} ({contact.type === 'customer' ? 'Kunde' : 'Lieferant'})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

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

                                            {/* Amount */}
                                            <div className="col-span-3">
                                                <FormField
                                                    control={form.control}
                                                    name={`lines.${index}.amount`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Betrag (€)</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" step="0.01" {...field} />
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

                                {/* Balance Check */}
                                <div className={`p-4 rounded-lg ${isBalanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <span className="font-medium text-slate-700">Soll:</span>
                                            <span className="ml-2 font-bold">{formatCurrency(debitSum)}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-slate-700">Haben:</span>
                                            <span className="ml-2 font-bold">{formatCurrency(creditSum)}</span>
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
