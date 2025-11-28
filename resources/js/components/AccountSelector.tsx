import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

interface Account {
    id: number;
    code: string;
    name: string;
    type: string;
}

interface AccountSelectorProps {
    accounts: Account[] | undefined;
    value: string | undefined;
    onChange: (value: string) => void;
    placeholder?: string;
    filterType?: string[]; // Optional: filter by account type (e.g., ['revenue', 'expense'])
}

export function AccountSelector({ 
    accounts, 
    value, 
    onChange, 
    placeholder = "Konto wählen...",
    filterType 
}: AccountSelectorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredAccounts = useMemo(() => {
        if (!accounts) return [];
        
        let filtered = accounts;
        
        // Filter by type if specified
        if (filterType && filterType.length > 0) {
            filtered = filtered.filter((account) => filterType.includes(account.type));
        }
        
        // Filter by search
        if (search) {
            filtered = filtered.filter((account) =>
                account.name.toLowerCase().includes(search.toLowerCase()) ||
                account.code.toLowerCase().includes(search.toLowerCase())
            );
        }
        
        return filtered;
    }, [accounts, search, filterType]);

    const selectedAccount = accounts?.find((account) => String(account.id) === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {selectedAccount ? (
                        <span>
                            {selectedAccount.code} - {selectedAccount.name}
                        </span>
                    ) : (
                        placeholder
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <div className="p-2 border-b">
                    <div className="flex items-center px-2 border rounded-md">
                        <Search className="h-4 w-4 opacity-50 mr-2" />
                        <input
                            className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Konto suchen (Code oder Name)..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1">
                    {filteredAccounts.length === 0 && (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            Kein Konto gefunden.
                        </div>
                    )}
                    {filteredAccounts.map((account) => (
                        <div
                            key={account.id}
                            className={cn(
                                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                String(account.id) === value && "bg-accent text-accent-foreground"
                            )}
                            onClick={() => {
                                onChange(String(account.id));
                                setOpen(false);
                                setSearch('');
                            }}
                        >
                            <Check
                                className={cn(
                                    "mr-2 h-4 w-4",
                                    String(account.id) === value ? "opacity-100" : "opacity-0"
                                )}
                            />
                            <div className="flex flex-col">
                                <span className="font-medium">{account.code} - {account.name}</span>
                                <span className="text-xs text-muted-foreground">{account.type}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
