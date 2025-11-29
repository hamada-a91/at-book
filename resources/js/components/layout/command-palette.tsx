import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import {
    LayoutDashboard,
    FileText,
    Users,
    Building2,
    Settings,
    Plus,
    Receipt,
    BookOpen,
} from 'lucide-react';

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const runCommand = (command: () => void) => {
        setOpen(false);
        command();
    };

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Suche nach Seiten oder Aktionen..." />
            <CommandList>
                <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
                <CommandGroup heading="Navigation">
                    <CommandItem
                        onSelect={() => runCommand(() => navigate('/'))}
                        className="gap-2"
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Dashboard</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => runCommand(() => navigate('/invoices'))}
                        className="gap-2"
                    >
                        <FileText className="w-4 h-4" />
                        <span>Rechnungen</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => runCommand(() => navigate('/contacts'))}
                        className="gap-2"
                    >
                        <Users className="w-4 h-4" />
                        <span>Kontakte</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => runCommand(() => navigate('/accounts'))}
                        className="gap-2"
                    >
                        <Building2 className="w-4 h-4" />
                        <span>Konten</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => runCommand(() => navigate('/journal'))}
                        className="gap-2"
                    >
                        <BookOpen className="w-4 h-4" />
                        <span>Journal</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => runCommand(() => navigate('/settings'))}
                        className="gap-2"
                    >
                        <Settings className="w-4 h-4" />
                        <span>Einstellungen</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Aktionen">
                    <CommandItem
                        onSelect={() => runCommand(() => navigate('/invoices/create'))}
                        className="gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Neue Rechnung</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => runCommand(() => navigate('/contacts/create'))}
                        className="gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Neuer Kontakt</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => runCommand(() => navigate('/accounts/create'))}
                        className="gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Neues Konto</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => runCommand(() => navigate('/bookings/create'))}
                        className="gap-2"
                    >
                        <Receipt className="w-4 h-4" />
                        <span>Neue Buchung</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
