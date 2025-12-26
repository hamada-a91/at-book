import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Plus, Search, Pencil, Trash2, Eye, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { ContactForm, ContactFormValues } from '@/components/ContactForm';
import { Badge } from '@/components/ui/badge';

interface Contact {
    id: number;
    name: string;
    type: 'customer' | 'vendor' | 'both' | 'other';
    customer_account_id?: number;
    vendor_account_id?: number;
    tax_number: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
    notice: string | null;
    bank_account: string | null;
    contact_person: string | null;
    balance: number;
    balance_formatted: string;
    customer_balance?: number;
    vendor_balance?: number;
    account_id?: number;
}

export function ContactsList() {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editContact, setEditContact] = useState<Contact | null>(null);
    const [viewContact, setViewContact] = useState<Contact | null>(null);
    const [deleteContact, setDeleteContact] = useState<Contact | null>(null);
    const [search, setSearch] = useState('');

    const queryClient = useQueryClient();

    const { data: contacts, isLoading } = useQuery<Contact[]>({
        queryKey: ['contacts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/contacts');
            return data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: ContactFormValues) => {
            try {
                const { data: newContact } = await axios.post('/api/contacts', data);
                return newContact;
            } catch (error: any) {
                const errorMsg = error.response?.data?.message || 'Fehler beim Erstellen';
                throw new Error(errorMsg);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            setIsCreateOpen(false);
        },
        onError: (error: Error) => {
            alert(error.message);
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (data: ContactFormValues) => {
            if (!editContact) return;
            try {
                const { data: updatedContact } = await axios.put(`/api/contacts/${editContact.id}`, data);
                return updatedContact;
            } catch (error: any) {
                const errorMsg = error.response?.data?.message || 'Fehler beim Aktualisieren';
                throw new Error(errorMsg);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            setEditContact(null);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            try {
                const { data } = await axios.delete(`/api/contacts/${id}`);
                return data;
            } catch (error: any) {
                const errorMsg = error.response?.data?.error || 'Fehler beim Löschen';
                throw new Error(errorMsg);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            setDeleteContact(null);
        },
        onError: (error: Error) => {
            alert(error.message); // Simple alert for error
            setDeleteContact(null);
        }
    });

    // Filter contacts based on search
    const filteredContacts = contacts?.filter((contact) => {
        const matchesSearch = search === '' ||
            contact.name.toLowerCase().includes(search.toLowerCase()) ||
            (contact.email && contact.email.toLowerCase().includes(search.toLowerCase())) ||
            (contact.phone && contact.phone.includes(search));
        return matchesSearch;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Kontakte</h1>
                    <p className="text-slate-500 dark:text-slate-400">Debitoren & Kreditoren verwalten</p>
                </div>

                <Button
                    className="shadow-lg shadow-green-100/20 hover:shadow-green-200/30 transition-all duration-300 bg-gradient-to-r from-green-300 to-green-500 hover:from-green-700 hover:to-green-600"
                    onClick={() => setIsCreateOpen(true)}
                >
                    <Plus className="w-4 h-4" />
                    Neuer Kontakt
                </Button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Suche nach Name, E-Mail oder Telefon..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                </div>
            </div>

            {/* List */}
            <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                {isLoading ? (
                    <CardContent className="p-12 flex justify-center">
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800 rounded-full mb-4"></div>
                            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
                        </div>
                    </CardContent>
                ) : filteredContacts?.length === 0 ? (
                    <CardContent className="p-12 text-center text-slate-500 dark:text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <User className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">Keine Kontakte gefunden</h3>
                        <p className="mb-6">Erstellen Sie Ihren ersten Kontakt.</p>
                        <Button variant="outline" onClick={() => setIsCreateOpen(true)}>Neuen Kontakt erstellen</Button>
                    </CardContent>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Name</th>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Typ</th>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Steuernummer</th>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Kontakt</th>
                                    <th className="px-6 py-4 text-right font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Saldo</th>
                                    <th className="px-6 py-4 text-right font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">Aktionen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredContacts?.map((contact) => (
                                    <tr key={contact.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{contact.name}</td>
                                        <td className="px-6 py-4">
                                            {contact.type === 'customer' && (
                                                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                                                    Kunde
                                                </Badge>
                                            )}
                                            {contact.type === 'vendor' && (
                                                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                                    Lieferant
                                                </Badge>
                                            )}
                                            {contact.type === 'both' && (
                                                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                                                    Kunde & Lieferant
                                                </Badge>
                                            )}
                                            {contact.type === 'other' && (
                                                <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                                                    Sonstiges
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{contact.tax_number || '-'}</td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            {contact.email && <div className="flex items-center gap-2">{contact.email}</div>}
                                            {contact.phone && <div className="text-xs opacity-75">{contact.phone}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono">
                                            <div className={contact.balance > 0 ? 'text-emerald-600' : contact.balance < 0 ? 'text-rose-600' : ''}>
                                                {contact.balance_formatted}
                                            </div>
                                            {contact.type === 'both' && (
                                                <div className="text-[10px] text-slate-400 mt-1">
                                                    Netto Saldo
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                                    onClick={() => setViewContact(contact)}
                                                    title="Ansehen"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                    onClick={() => setEditContact(contact)}
                                                    title="Bearbeiten"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                                    onClick={() => setDeleteContact(contact)}
                                                    title="Löschen"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Neuen Kontakt erstellen</DialogTitle>
                    </DialogHeader>
                    <ContactForm
                        onSubmit={(data) => createMutation.mutate(data)}
                        isSubmitting={createMutation.isPending}
                    />
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={!!editContact} onOpenChange={(open) => !open && setEditContact(null)}>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Kontakt bearbeiten</DialogTitle>
                    </DialogHeader>
                    {editContact && (
                        <ContactForm
                            defaultValues={{
                                name: editContact.name,
                                type: editContact.type,
                                tax_number: editContact.tax_number || '',
                                address: editContact.address || '',
                                email: editContact.email || '',
                                phone: editContact.phone || '',
                                notice: editContact.notice || '',
                                bank_account: editContact.bank_account || '',
                                contact_person: editContact.contact_person || '',
                                account_id: editContact.account_id ? String(editContact.account_id) : undefined,
                            }}
                            onSubmit={(data) => updateMutation.mutate(data)}
                            isSubmitting={updateMutation.isPending}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* View Dialog */}
            <Dialog open={!!viewContact} onOpenChange={(open) => !open && setViewContact(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Kontakt Details</DialogTitle>
                    </DialogHeader>
                    {viewContact && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Name</label>
                                    <div className="font-medium text-slate-900 dark:text-slate-100">{viewContact.name}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Typ</label>
                                    <div>
                                        {viewContact.type === 'customer' && 'Kunde'}
                                        {viewContact.type === 'vendor' && 'Lieferant'}
                                        {viewContact.type === 'both' && 'Kunde & Lieferant'}
                                        {viewContact.type === 'other' && 'Sonstiges (Neutral)'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Steuernummer</label>
                                    <div>{viewContact.tax_number || '-'}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Telefon</label>
                                    <div>{viewContact.phone || '-'}</div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">E-Mail</label>
                                    <div>{viewContact.email || '-'}</div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Adresse</label>
                                    <div className="whitespace-pre-wrap">{viewContact.address || '-'}</div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Bankkonto</label>
                                    <div>{viewContact.bank_account || '-'}</div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Ansprechpartner</label>
                                    <div>{viewContact.contact_person || '-'}</div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Notiz</label>
                                    <div className="whitespace-pre-wrap text-sm bg-slate-50 dark:bg-slate-900 p-2 rounded">{viewContact.notice || '-'}</div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setViewContact(null)}>Schließen</Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteContact} onOpenChange={(open) => !open && setDeleteContact(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kontakt löschen?</DialogTitle>
                        <DialogDescription>
                            Möchten Sie den Kontakt "{deleteContact?.name}" wirklich löschen?
                            Dies ist nur möglich, wenn keine Buchungen für diesen Kontakt existieren.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteContact(null)}>Abbrechen</Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteContact && deleteMutation.mutate(deleteContact.id)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Löscht...' : 'Löschen'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
