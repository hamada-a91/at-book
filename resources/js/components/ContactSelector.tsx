import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ContactForm, ContactFormValues } from '@/components/ContactForm';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Contact {
    id: number;
    name: string;
    type: 'customer' | 'vendor';
}

interface ContactSelectorProps {
    contacts: Contact[] | undefined;
    value: string | undefined;
    onChange: (value: string) => void;
}

export function ContactSelector({ contacts, value, onChange }: ContactSelectorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const queryClient = useQueryClient();

    const filteredContacts = useMemo(() => {
        if (!contacts) return [];
        if (!search) return contacts;
        return contacts.filter((contact) =>
            contact.name.toLowerCase().includes(search.toLowerCase())
        );
    }, [contacts, search]);

    const selectedContact = contacts?.find((contact) => String(contact.id) === value);

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
        onSuccess: (newContact) => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            onChange(String(newContact.id));
            setIsDialogOpen(false);
            setOpen(false);
            setSearch('');
        },
    });

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between font-normal"
                    >
                        {selectedContact ? (
                            <span>
                                {selectedContact.name} <span className="text-muted-foreground text-xs">({selectedContact.type === 'customer' ? 'Kunde' : 'Lieferant'})</span>
                            </span>
                        ) : (
                            "Kontakt wählen..."
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                    <div className="p-2 border-b">
                        <div className="flex items-center px-2 border rounded-md">
                            <Search className="h-4 w-4 opacity-50 mr-2" />
                            <input
                                className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Kontakt suchen..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto p-1">
                        {filteredContacts.length === 0 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                Kein Kontakt gefunden.
                            </div>
                        )}
                        {filteredContacts.map((contact) => (
                            <div
                                key={contact.id}
                                className={cn(
                                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                    String(contact.id) === value && "bg-accent text-accent-foreground"
                                )}
                                onClick={() => {
                                    onChange(String(contact.id));
                                    setOpen(false);
                                    setSearch('');
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        String(contact.id) === value ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <div className="flex flex-col">
                                    <span>{contact.name}</span>
                                    <span className="text-xs text-muted-foreground">{contact.type === 'customer' ? 'Kunde' : 'Lieferant'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-2 border-t bg-slate-50">
                        <DialogTrigger asChild>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => {
                                    // Keep popover open or handle dialog logic
                                }}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Neuen Kontakt erstellen
                            </Button>
                        </DialogTrigger>
                    </div>
                </PopoverContent>
            </Popover>

            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Neuen Kontakt erstellen</DialogTitle>
                </DialogHeader>
                <ContactForm
                    onSubmit={(data) => createMutation.mutate(data)}
                    isSubmitting={createMutation.isPending}
                    defaultValues={{ name: search }} // Pre-fill name with search term
                />
            </DialogContent>
        </Dialog>
    );
}
