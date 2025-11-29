import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Plus, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Account {
    id: number;
    code: string;
    name: string;
    type: string;
    tax_key_code: string | null;
    balance?: number;
    balance_formatted?: string;
}

const accountTypeLabels: Record<string, string> = {
    asset: 'Aktiva',
    liability: 'Passiva',
    equity: 'Eigenkapital',
    revenue: 'Erlöse',
    expense: 'Aufwand',
};

const accountTypeStyles: Record<string, string> = {
    asset: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    liability: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    equity: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    revenue: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    expense: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
};

export function AccountsList() {
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    const { data: accounts, isLoading } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => {
            const res = await fetch('/api/accounts');
            return res.json();
        },
    });

    const filteredAccounts = accounts?.filter((account) => {
        const matchesSearch =
            search === '' ||
            account.code.toLowerCase().includes(search.toLowerCase()) ||
            account.name.toLowerCase().includes(search.toLowerCase());

        const matchesType = typeFilter === 'all' || account.type === typeFilter;

        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Kontenplan (SKR03)</h1>
                    <p className="text-slate-500 dark:text-slate-400">Übersicht aller Sachkonten</p>
                </div>
                <Link to="/accounts/create">
                    <Button className="gap-2 shadow-lg shadow-primary/20">
                        <Plus className="w-4 h-4" />
                        Neues Konto
                    </Button>
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full md:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Suche nach Konto-Nr. oder Name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                </div>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full md:w-[200px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                        <SelectValue placeholder="Alle Kontenarten" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Kontenarten</SelectItem>
                        <SelectItem value="asset">Aktiva</SelectItem>
                        <SelectItem value="liability">Passiva</SelectItem>
                        <SelectItem value="revenue">Erlöse</SelectItem>
                        <SelectItem value="expense">Aufwand</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Accounts Table */}
            <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                {isLoading ? (
                    <CardContent className="p-12 flex justify-center">
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800 rounded-full mb-4"></div>
                            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
                        </div>
                    </CardContent>
                ) : filteredAccounts && filteredAccounts.length === 0 ? (
                    <CardContent className="p-12 text-center text-slate-500 dark:text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">Keine Konten gefunden</h3>
                        <p className="mb-6">Versuchen Sie es mit anderen Suchbegriffen.</p>
                    </CardContent>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                            Konto-Nr.
                                        </th>
                                        <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                            Bezeichnung
                                        </th>
                                        <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                            Kontenart
                                        </th>
                                        <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                            Steuerschlüssel
                                        </th>
                                        <th className="px-6 py-4 text-right font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                            Saldo
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredAccounts?.map((account) => (
                                        <tr key={account.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                    {account.code}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-medium">{account.name}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline" className={`font-normal ${accountTypeStyles[account.type] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                    {accountTypeLabels[account.type] || account.type}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                                                {account.tax_key_code || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`font-semibold ${account.balance && account.balance > 0
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : account.balance && account.balance < 0
                                                        ? 'text-rose-600 dark:text-rose-400'
                                                        : 'text-slate-500 dark:text-slate-400'
                                                    }`}>
                                                    {account.balance_formatted || '0,00 €'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-slate-50/50 dark:bg-slate-800/50 px-6 py-4 border-t border-slate-200 dark:border-slate-800">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Zeige <span className="font-semibold text-slate-900 dark:text-slate-100">{filteredAccounts?.length}</span> von{' '}
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{accounts?.length}</span> Konten
                            </p>
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
}
