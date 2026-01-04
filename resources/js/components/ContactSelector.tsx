import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';

import { ContactForm, ContactFormValues } from '@/components/ContactForm';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Contact {
    id: number;
    name: string;
    type: 'customer' | 'vendor' | 'both' | 'other';
    customer_account_id?: number;
    vendor_account_id?: number;
}

interface ContactSelectorProps {
    contacts: Contact[] | undefined;
    value: string | undefined;
    onChange: (value: string) => void;
}

const typeLabels: Record<string, { label: string; color: string }> = {
    customer: { label: 'Kunde', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    vendor: { label: 'Lieferant', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    both: { label: 'Kunde & Lieferant', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    other: { label: 'Sonstiges', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
};

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
            const { data: newContact } = await axios.post('/api/contacts', data);
            return newContact;
        },
        onSuccess: (newContact) => {
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
            onChange(String(newContact.id));
            setIsDialogOpen(false);
            setOpen(false);
            setSearch('');
        },
    });

    const handleSelect = (contact: Contact) => {
        onChange(String(contact.id));
        setOpen(false);
        setSearch('');
    };

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    >
                        {selectedContact ? (
                            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                                <User className="h-4 w-4 text-slate-500" />
                                <span className="font-medium">{selectedContact.name}</span>
                                <Badge className={cn("text-xs", typeLabels[selectedContact.type]?.color)}>
                                    {typeLabels[selectedContact.type]?.label}
                                </Badge>
                            </div>
                        ) : (
                            <span className="text-slate-500">Kontakt wählen...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start" sideOffset={4}>
                    {/* Search Input */}
                    <div className="flex items-center border-b border-slate-200 px-3 dark:border-slate-700">
                        <Search className="h-4 w-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Kontakt suchen..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                            autoFocus
                        />
                    </div>

                    {/* Contact List */}
                    <div className="max-h-[250px] overflow-y-auto p-1">
                        {filteredContacts.length === 0 ? (
                            <div className="py-6 text-center text-sm text-slate-500">
                                Kein Kontakt gefunden.
                            </div>
                        ) : (
                            filteredContacts.map((contact) => (
                                <div
                                    key={contact.id}
                                    className={cn(
                                        "flex items-center justify-between rounded-md px-3 py-2 cursor-pointer transition-colors",
                                        "hover:bg-indigo-50 dark:hover:bg-indigo-900/30",
                                        String(contact.id) === value && "bg-indigo-50 dark:bg-indigo-900/30"
                                    )}
                                    onClick={() => handleSelect(contact)}
                                >
                                    <div className="flex items-center gap-2">
                                        <Check
                                            className={cn(
                                                "h-4 w-4 text-indigo-600",
                                                String(contact.id) === value ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span className="font-medium text-slate-900 dark:text-slate-100">
                                            {contact.name}
                                        </span>
                                    </div>
                                    <Badge className={cn("text-xs", typeLabels[contact.type]?.color)}>
                                        {typeLabels[contact.type]?.label}
                                    </Badge>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Create New Contact Button */}
                    <div className="border-t border-slate-200 dark:border-slate-700 p-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                            onClick={() => {
                                setOpen(false);
                                setIsDialogOpen(true);
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Neuen Kontakt erstellen
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>

            {/* Create Contact Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Neuen Kontakt erstellen</DialogTitle>
                    </DialogHeader>
                    <ContactForm
                        onSubmit={(data) => createMutation.mutate(data)}
                        isSubmitting={createMutation.isPending}
                        defaultValues={{ name: search }}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
