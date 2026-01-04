import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Plus, Search, Pencil, Trash2, Eye, Star, Landmark, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { BankAccountForm, BankAccountFormValues } from '@/components/BankAccountForm';
import { Badge } from '@/components/ui/badge';

interface BankAccount {
    id: number;
    name: string;
    bank_name: string;
    iban: string;
    bic: string | null;
    account_number: string | null;
    bank_code: string | null;
    currency: string;
    balance: number;
    balance_formatted: string;
    formatted_iban: string;
    type: 'checking' | 'savings' | 'credit_card';
    is_default: boolean;
    notes: string | null;
    sachkonto_code?: string;
    sachkonto_name?: string;
}

const accountTypeLabels: Record<string, string> = {
    checking: 'Girokonto',
    savings: 'Sparkonto',
    credit_card: 'Kreditkarte',
};

const accountTypeStyles: Record<string, string> = {
    checking: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    savings: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    credit_card: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
};

export function BankAccountsList() {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editAccount, setEditAccount] = useState<BankAccount | null>(null);
    const [viewAccount, setViewAccount] = useState<BankAccount | null>(null);
    const [deleteAccount, setDeleteAccount] = useState<BankAccount | null>(null);
    const [search, setSearch] = useState('');

    const queryClient = useQueryClient();

    const { data: accounts, isLoading } = useQuery<BankAccount[]>({
        queryKey: ['bank-accounts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/bank-accounts');
            return data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: BankAccountFormValues) => {
            try {
                const { data: newAccount } = await axios.post('/api/bank-accounts', data);
                return newAccount;
            } catch (error: any) {
                throw new Error(error.response?.data?.message || 'Fehler beim Erstellen');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
            setIsCreateOpen(false);
        },
        onError: (error: Error) => {
            alert(error.message);
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (data: BankAccountFormValues) => {
            if (!editAccount) return;
            try {
                const { data: updatedAccount } = await axios.put(`/api/bank-accounts/${editAccount.id}`, data);
                return updatedAccount;
            } catch (error: any) {
                throw new Error('Fehler beim Aktualisieren');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
            setEditAccount(null);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            try {
                const { data } = await axios.delete(`/api/bank-accounts/${id}`);
                return data;
            } catch (error: any) {
                const errorMsg = error.response?.data?.error || 'Fehler beim Löschen';
                throw new Error(errorMsg);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
            setDeleteAccount(null);
        },
        onError: (error: Error) => {
            alert(error.message);
            setDeleteAccount(null);
        }
    });

    const setDefaultMutation = useMutation({
        mutationFn: async (id: number) => {
            const { data } = await axios.post(`/api/bank-accounts/${id}/set-default`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
        },
    });

    // Filter accounts based on search
    const filteredAccounts = accounts?.filter((account) => {
        const matchesSearch = search === '' ||
            account.name.toLowerCase().includes(search.toLowerCase()) ||
            account.bank_name.toLowerCase().includes(search.toLowerCase()) ||
            account.iban.toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Bank Konten</h1>
                    <p className="text-slate-500 dark:text-slate-400">Ihre Bankkonten verwalten</p>
                </div>

                <Button
                    className="shadow-lg shadow-emerald-100/20 hover:shadow-emerald-200/30 transition-all duration-300 bg-gradient-to-r from-emerald-300 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600"
                    onClick={() => setIsCreateOpen(true)}
                >
                    <Plus className="w-4 h-4" />
                    Neues Konto
                </Button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Suche nach Name, Bank oder IBAN..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                </div>
            </div>

            {/* List */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <div className="col-span-full p-12 flex justify-center">
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800 rounded-full mb-4"></div>
                            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
                        </div>
                    </div>
                ) : filteredAccounts?.length === 0 ? (
                    <div className="col-span-full p-12 text-center text-slate-500 dark:text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Landmark className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">Keine Bankkonten gefunden</h3>
                        <p className="mb-6">Erstellen Sie Ihr erstes Bankkonto.</p>
                        <Button variant="outline" onClick={() => setIsCreateOpen(true)}>Neues Konto erstellen</Button>
                    </div>
                ) : (
                    filteredAccounts?.map((account) => (
                        <Card key={account.id} className={`relative shadow-sm border-none backdrop-blur-sm overflow-hidden group hover:shadow-lg transition-all duration-300 ${account.is_default ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' : 'bg-white/50 dark:bg-slate-900/50'}`}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${account.type === 'checking' ? 'bg-blue-100 dark:bg-blue-900/30' : account.type === 'savings' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-purple-100 dark:bg-purple-900/30'}`}>
                                            {account.type === 'credit_card' ? (
                                                <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                            ) : (
                                                <Landmark className={`w-6 h-6 ${account.type === 'checking' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                                            )}
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg mb-1">{account.name}</CardTitle>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{account.bank_name}</p>
                                        </div>
                                    </div>
                                    {account.is_default && (
                                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                                            <Star className="w-3 h-3 mr-1 fill-current" />
                                            Standard
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">IBAN</p>
                                    <p className="font-mono text-sm">{account.formatted_iban}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className={accountTypeStyles[account.type]}>
                                        {accountTypeLabels[account.type]}
                                    </Badge>
                                    {account.sachkonto_code && (
                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800">
                                            Konto {account.sachkonto_code}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Saldo</p>
                                        <p className={`text-lg font-bold ${account.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                            {account.balance_formatted}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!account.is_default && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                                onClick={() => setDefaultMutation.mutate(account.id)}
                                                title="Als Standard festlegen"
                                            >
                                                <Star className="w-4 h-4" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                            onClick={() => setViewAccount(account)}
                                            title="Ansehen"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                            onClick={() => setEditAccount(account)}
                                            title="Bearbeiten"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                            onClick={() => setDeleteAccount(account)}
                                            title="Löschen"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Neues Bankkonto erstellen</DialogTitle>
                    </DialogHeader>
                    <BankAccountForm
                        onSubmit={(data) => createMutation.mutate(data)}
                        isSubmitting={createMutation.isPending}
                    />
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={!!editAccount} onOpenChange={(open) => !open && setEditAccount(null)}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Bankkonto bearbeiten</DialogTitle>
                    </DialogHeader>
                    {editAccount && (
                        <BankAccountForm
                            defaultValues={{
                                name: editAccount.name,
                                bank_name: editAccount.bank_name,
                                iban: editAccount.iban,
                                bic: editAccount.bic || '',
                                account_number: editAccount.account_number || '',
                                bank_code: editAccount.bank_code || '',
                                currency: editAccount.currency,
                                type: editAccount.type,
                                is_default: editAccount.is_default,
                                notes: editAccount.notes || '',
                            }}
                            onSubmit={(data) => updateMutation.mutate(data)}
                            isSubmitting={updateMutation.isPending}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* View Dialog */}
            <Dialog open={!!viewAccount} onOpenChange={(open) => !open && setViewAccount(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Bankkonto Details</DialogTitle>
                    </DialogHeader>
                    {viewAccount && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Name</label>
                                    <div className="font-medium text-slate-900 dark:text-slate-100">{viewAccount.name}</div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Bank</label>
                                    <div>{viewAccount.bank_name}</div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">IBAN</label>
                                    <div className="font-mono text-sm">{viewAccount.formatted_iban}</div>
                                </div>
                                {viewAccount.bic && (
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">BIC</label>
                                        <div className="font-mono text-sm">{viewAccount.bic}</div>
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Kontoart</label>
                                    <div>{accountTypeLabels[viewAccount.type]}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Währung</label>
                                    <div>{viewAccount.currency}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Saldo</label>
                                    <div className="font-bold">{viewAccount.balance_formatted}</div>
                                </div>
                                {viewAccount.notes && (
                                    <div className="col-span-2">
                                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Notizen</label>
                                        <div className="whitespace-pre-wrap text-sm bg-slate-50 dark:bg-slate-900 p-2 rounded">{viewAccount.notes}</div>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setViewAccount(null)}>Schließen</Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteAccount} onOpenChange={(open) => !open && setDeleteAccount(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Bankkonto löschen?</DialogTitle>
                        <DialogDescription>
                            Möchten Sie das Bankkonto "{deleteAccount?.name}" wirklich löschen?
                            Diese Aktion kann nicht rückgängig gemacht werden.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteAccount(null)}>Abbrechen</Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteAccount && deleteMutation.mutate(deleteAccount.id)}
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
