import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Plus, Filter, Download } from 'lucide-react';
import { Navigation } from '@/components/Layout/Navigation';
import { PageHeader } from '@/components/Layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Account {
    id: number;
    code: string;
    name: string;
    type: string;
    tax_key_code: string | null;
}

const accountTypeLabels: Record<string, string> = {
    asset: 'Aktiva',
    liability: 'Passiva',
    equity: 'Eigenkapital',
    revenue: 'Erlöse',
    expense: 'Aufwand',
};

const accountTypeColors: Record<string, string> = {
    asset: 'bg-blue-50 text-blue-700 border-blue-200',
    liability: 'bg-red-50 text-red-700 border-red-200',
    equity: 'bg-purple-50 text-purple-700 border-purple-200',
    revenue: 'bg-green-50 text-green-700 border-green-200',
    expense: 'bg-amber-50 text-amber-700 border-amber-200',
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

    // Group by type
    const groupedAccounts = filteredAccounts?.reduce((groups, account) => {
        const type = account.type;
        if (!groups[type]) {
            groups[type] = [];
        }
        groups[type].push(account);
        return groups;
    }, {} as Record<string, Account[]>);

    return (
        <Navigation>
            <PageHeader
                title="Kontenplan (SKR03)"
                subtitle="Übersicht aller Sachkonten"
                action={{
                    label: 'Neues Konto',
                    icon: Plus,
                    href: '/accounts/create',
                }}
                stats={[
                    { label: 'Gesamt', value: accounts?.length || 0 },
                    { label: 'Gefiltert', value: filteredAccounts?.length || 0 },
                ]}
            />

            {/* Filters */}
            <Card className="shadow-md mb-8">
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Search */}
                        <div className="md:col-span-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <Input
                                    type="text"
                                    placeholder="Suche nach Kontonummer oder Name..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-10 pr-4"
                                />
                            </div>
                        </div>

                        {/* Type Filter */}
                        <div>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger>
                                    <Filter className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder="Kontoart filtern" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Alle Kontoarten</SelectItem>
                                    <SelectItem value="asset">Aktiva</SelectItem>
                                    <SelectItem value="liability">Passiva</SelectItem>
                                    <SelectItem value="equity">Eigenkapital</SelectItem>
                                    <SelectItem value="revenue">Erlöse</SelectItem>
                                    <SelectItem value="expense">Aufwand</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Active Filters */}
                    {(search || typeFilter !== 'all') && (
                        <div className="mt-4 flex items-center space-x-2">
                            <span className="text-sm text-slate-600">Aktive Filter:</span>
                            {search && (
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                    Suche: "{search}"
                                </span>
                            )}
                            {typeFilter !== 'all' && (
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                    Typ: {accountTypeLabels[typeFilter]}
                                </span>
                            )}
                            <button
                                onClick={() => {
                                    setSearch('');
                                    setTypeFilter('all');
                                }}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium ml-2"
                            >
                                Zurücksetzen
                            </button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Accounts Display */}
            {isLoading ? (
                <Card className="shadow-md">
                    <CardContent className="p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-slate-600">Lade Konten...</p>
                    </CardContent>
                </Card>
            ) : !filteredAccounts || filteredAccounts.length === 0 ? (
                <Card className="shadow-md">
                    <CardContent className="p-12 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Keine Konten gefunden</h3>
                        <p className="text-slate-600 mb-6">
                            {search || typeFilter !== 'all'
                                ? 'Versuchen Sie, Ihre Filter anzupassen.'
                                : 'Fügen Sie Ihr erstes Konto hinzu, um zu beginnen.'}
                        </p>
                        {!search && typeFilter === 'all' && (
                            <Link to="/accounts/create">
                                <Button>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Erstes Konto erstellen
                                </Button>
                            </Link>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedAccounts || {}).map(([type, typeAccounts]) => (
                        <div key={type}>
                            {/* Type Header */}
                            <div className="flex items-center space-x-3 mb-4">
                                <div className={`px-4 py-2 rounded-lg border ${accountTypeColors[type]}`}>
                                    <h2 className="text-lg font-semibold">
                                        {accountTypeLabels[type] || type}
                                    </h2>
                                </div>
                                <span className="text-sm text-slate-500">
                                    {typeAccounts.length} {typeAccounts.length === 1 ? 'Konto' : 'Konten'}
                                </span>
                            </div>

                            {/* Accounts Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {typeAccounts.map((account) => (
                                    <Card
                                        key={account.id}
                                        className="hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                                    >
                                        <CardContent className="p-5">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-2 mb-1">
                                                        <span className="text-lg font-bold text-blue-600">
                                                            {account.code}
                                                        </span>
                                                        {account.tax_key_code && (
                                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                                                                {account.tax_key_code}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="font-medium text-slate-900 leading-tight">
                                                        {account.name}
                                                    </h3>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                                <span className={`text-xs font-medium px-2 py-1 rounded ${accountTypeColors[account.type]}`}>
                                                    {accountTypeLabels[account.type] || account.type}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Navigation>
    );
}
