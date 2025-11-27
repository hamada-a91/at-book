import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigation } from '@/components/Layout/Navigation';
import { Plus, Eye, Pencil, Trash2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { ContactForm, ContactFormValues } from '@/components/ContactForm';

interface Contact {
    id: number;
    name: string;
    type: 'customer' | 'vendor';
    tax_number: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
    notice: string | null;
    bank_account: string | null;
    contact_person: string | null;
}

export function ContactsList() {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editContact, setEditContact] = useState<Contact | null>(null);
    const [viewContact, setViewContact] = useState<Contact | null>(null);
    const [deleteContact, setDeleteContact] = useState<Contact | null>(null);

    const queryClient = useQueryClient();

    const { data: contacts, isLoading } = useQuery<Contact[]>({
        queryKey: ['contacts'],
        queryFn: async () => {
            const res = await fetch('/api/contacts');
            return res.json();
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
            setIsCreateOpen(false);
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (data: ContactFormValues) => {
            if (!editContact) return;
            const res = await fetch(`/api/contacts/${editContact.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Fehler beim Aktualisieren');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            setEditContact(null);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/contacts/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Fehler beim Löschen');
            }
            return res.json();
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

    return (
        <Navigation>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-900">Kontakte</h1>
                        <p className="text-slate-600">Debitoren & Kreditoren verwalten</p>
                    </div>

                    <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
                        <Plus className="w-4 h-4" />
                        Neuer Kontakt
                    </Button>
                </div>

                {/* List */}
                <Card className="shadow-lg">
                    {isLoading ? (
                        <CardContent className="p-8 text-center">Lade Kontakte...</CardContent>
                    ) : contacts?.length === 0 ? (
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
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-700 uppercase">Aktionen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {contacts?.map((contact) => (
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
                                            <td className="px-6 py-4 text-right space-x-2">
                                                <Button variant="ghost" size="icon" onClick={() => setViewContact(contact)}>
                                                    <Eye className="w-4 h-4 text-slate-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => setEditContact(contact)}>
                                                    <Pencil className="w-4 h-4 text-blue-500" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => setDeleteContact(contact)}>
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
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
                                        <label className="text-xs font-medium text-slate-500">Name</label>
                                        <div className="font-medium">{viewContact.name}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500">Typ</label>
                                        <div>{viewContact.type === 'customer' ? 'Kunde' : 'Lieferant'}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500">Steuernummer</label>
                                        <div>{viewContact.tax_number || '-'}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500">Telefon</label>
                                        <div>{viewContact.phone || '-'}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-medium text-slate-500">E-Mail</label>
                                        <div>{viewContact.email || '-'}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-medium text-slate-500">Adresse</label>
                                        <div className="whitespace-pre-wrap">{viewContact.address || '-'}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-medium text-slate-500">Bankkonto</label>
                                        <div>{viewContact.bank_account || '-'}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-medium text-slate-500">Ansprechpartner</label>
                                        <div>{viewContact.contact_person || '-'}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-medium text-slate-500">Notiz</label>
                                        <div className="whitespace-pre-wrap text-sm bg-slate-50 p-2 rounded">{viewContact.notice || '-'}</div>
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
        </Navigation>
    );
}
