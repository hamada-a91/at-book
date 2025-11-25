import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    asset: 'bg-blue-100 text-blue-700',
    liability: 'bg-red-100 text-red-700',
    equity: 'bg-purple-100 text-purple-700',
    revenue: 'bg-green-100 text-green-700',
    expense: 'bg-yellow-100 text-yellow-700',
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="container mx-auto py-8 px-4">
                {/* Header */}
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <Link to="/" className="text-blue-600 hover:underline mb-2 inline-flex items-center gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Zurück zum Dashboard
                        </Link>
                        <h1 className="text-4xl font-bold text-slate-900">Kontenplan (SKR03)</h1>
                        <p className="text-slate-600">Übersicht aller Sachkonten</p>
                    </div>
                    <Link to="/accounts/create">
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            Neues Konto
                        </Button>
                    </Link>
                </div>

                {/* Filters */}
                <Card className="shadow-lg mb-6">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                type="text"
                                placeholder="Suche nach Konto-Nr. oder Name..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />

                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger>
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
                    </CardContent>
                </Card>

                {/* Accounts Table */}
                <Card className="shadow-lg">
                    {isLoading ? (
                        <CardContent className="p-8 text-center">
                            <p className="text-slate-600">Lade Kontenplan...</p>
                        </CardContent>
                    ) : filteredAccounts && filteredAccounts.length === 0 ? (
                        <CardContent className="p-8 text-center">
                            <p className="text-slate-600">Keine Konten gefunden.</p>
                        </CardContent>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-100 border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                                                Konto-Nr.
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                                                Bezeichnung
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                                                Kontenart
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">
                                                Steuerschlüssel
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {filteredAccounts?.map((account) => (
                                            <tr key={account.id} className="hover:bg-slate-50 transition">
                                                <td className="px-6 py-4">
                                                    <span className="font-mono font-bold text-slate-900">{account.code}</span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-700">{account.name}</td>
                                                <td className="px-6 py-4">
                                                    <span
                                                        className={`px-2 py-1 text-xs font-semibold rounded-full ${accountTypeColors[account.type] || 'bg-gray-100 text-gray-700'
                                                            }`}
                                                    >
                                                        {accountTypeLabels[account.type] || account.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-700">
                                                    {account.tax_key_code || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
                                <p className="text-sm text-slate-600">
                                    Zeige <span className="font-semibold">{filteredAccounts?.length}</span> von{' '}
                                    <span className="font-semibold">{accounts?.length}</span> Konten
                                </p>
                            </div>
                        </>
                    )}
                </Card>

                {/* Legend */}
                <Card className="shadow-lg mt-6">
                    <CardHeader>
                        <CardTitle>Kontenarten</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {Object.entries(accountTypeLabels).map(([type, label]) => (
                                <div key={type} className="flex items-center gap-2">
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${accountTypeColors[type]}`}>
                                        {label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
