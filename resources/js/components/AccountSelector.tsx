import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

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
    filterType?: string[];
}

const typeLabels: Record<string, { label: string; color: string }> = {
    asset: { label: 'Aktiv', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    liability: { label: 'Passiv', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    revenue: { label: 'Ertrag', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    expense: { label: 'Aufwand', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    equity: { label: 'Eigenkapital', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

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

    const handleSelect = (account: Account) => {
        onChange(String(account.id));
        setOpen(false);
        setSearch('');
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                >
                    {selectedAccount ? (
                        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                            <Calculator className="h-4 w-4 text-slate-500" />
                            <span className="font-medium">{selectedAccount.code}</span>
                            <span className="text-slate-500">-</span>
                            <span className="truncate">{selectedAccount.name}</span>
                        </div>
                    ) : (
                        <span className="text-slate-500">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start" sideOffset={4}>
                {/* Search Input */}
                <div className="flex items-center border-b border-slate-200 px-3 dark:border-slate-700">
                    <Search className="h-4 w-4 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Konto suchen (Code oder Name)..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                        autoFocus
                    />
                </div>

                {/* Account List */}
                <div className="max-h-[300px] overflow-y-auto p-1">
                    {filteredAccounts.length === 0 ? (
                        <div className="py-6 text-center text-sm text-slate-500">
                            Kein Konto gefunden.
                        </div>
                    ) : (
                        filteredAccounts.map((account) => (
                            <div
                                key={account.id}
                                className={cn(
                                    "flex items-center justify-between rounded-md px-3 py-2 cursor-pointer transition-colors",
                                    "hover:bg-indigo-50 dark:hover:bg-indigo-900/30",
                                    String(account.id) === value && "bg-indigo-50 dark:bg-indigo-900/30"
                                )}
                                onClick={() => handleSelect(account)}
                            >
                                <div className="flex items-center gap-2">
                                    <Check
                                        className={cn(
                                            "h-4 w-4 text-indigo-600",
                                            String(account.id) === value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                                        {account.code}
                                    </span>
                                    <span className="text-slate-500">-</span>
                                    <span className="text-slate-700 dark:text-slate-300">
                                        {account.name}
                                    </span>
                                </div>
                                <Badge className={cn("text-xs", typeLabels[account.type]?.color)}>
                                    {typeLabels[account.type]?.label || account.type}
                                </Badge>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
