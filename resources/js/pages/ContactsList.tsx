import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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

interface Contact {
    id: number;
    name: string;
    type: 'customer' | 'vendor';
    tax_number: string | null;
    email: string | null;
    phone: string | null;
}

const contactSchema = z.object({
    name: z.string().min(2, 'Name muss mindestens 2 Zeichen lang sein'),
    type: z.enum(['customer', 'vendor']),
    tax_number: z.string().optional(),
    address: z.string().optional(),
    email: z.string().email('Ungültige E-Mail').optional().or(z.literal('')),
    phone: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export function ContactsList() {
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: contacts, isLoading } = useQuery<Contact[]>({
        queryKey: ['contacts'],
        queryFn: async () => {
            const res = await fetch('/api/contacts');
            return res.json();
        },
    });

    const form = useForm<ContactFormValues>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: '',
            type: 'customer',
            tax_number: '',
            address: '',
            email: '',
            phone: '',
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: ContactFormValues) => {
            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Fehler beim Erstellen');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            setIsDialogOpen(false);
            form.reset();
        },
    });

    const onSubmit = (data: ContactFormValues) => {
        createMutation.mutate(data);
    };

    const filteredContacts = contacts?.filter((contact) =>
        contact.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="container mx-auto py-8 px-4">
                {/* Header */}
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <Link to="/" className="text-blue-600 hover:underline mb-2 inline-flex items-center gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Zurück zum Dashboard
                        </Link>
                        <h1 className="text-4xl font-bold text-slate-900">Kontakte</h1>
                        <p className="text-slate-600">Debitoren & Kreditoren verwalten</p>
                    </div>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="w-4 h-4" />
                                Neuer Kontakt
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Neuen Kontakt erstellen</DialogTitle>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Name / Firma *</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Typ *</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="customer">Kunde (Debitor)</SelectItem>
                                                        <SelectItem value="vendor">Lieferant (Kreditor)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="tax_number"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Steuernummer</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>E-Mail</FormLabel>
                                                <FormControl>
                                                    <Input type="email" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                                        {createMutation.isPending ? 'Speichert...' : 'Speichern'}
                                    </Button>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Search */}
                <Card className="shadow-lg mb-6">
                    <CardContent className="p-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Suche nach Name..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* List */}
                <Card className="shadow-lg">
                    {isLoading ? (
                        <CardContent className="p-8 text-center">Lade Kontakte...</CardContent>
                    ) : filteredContacts?.length === 0 ? (
                        <CardContent className="p-8 text-center text-slate-500">
                            Keine Kontakte gefunden.
                        </CardContent>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-100 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Typ</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Steuernummer</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Kontakt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredContacts?.map((contact) => (
                                        <tr key={contact.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium">{contact.name}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs rounded-full ${contact.type === 'customer'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {contact.type === 'customer' ? 'Kunde' : 'Lieferant'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{contact.tax_number || '-'}</td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {contact.email && <div>{contact.email}</div>}
                                                {contact.phone && <div className="text-xs">{contact.phone}</div>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
