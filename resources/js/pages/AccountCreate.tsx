import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const accountSchema = z.object({
    code: z.string().min(4, 'Code muss mindestens 4 Zeichen lang sein').max(10),
    name: z.string().min(3, 'Name ist erforderlich'),
    type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
    tax_key_code: z.string().optional(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

export function AccountCreate() {
    const navigate = useNavigate();
    const { tenant } = useParams();
    const queryClient = useQueryClient();

    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            code: '',
            name: '',
            type: 'asset',
            tax_key_code: '',
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: AccountFormValues) => {
            try {
                const { data: newAccount } = await axios.post('/api/accounts', data);
                return newAccount;
            } catch (error: any) {
                const errorMsg = error.response?.data?.message || 'Fehler beim Erstellen';
                throw new Error(errorMsg);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            navigate(`/${tenant}/accounts`);
        },
        onError: (error: Error) => {
            alert('Fehler: ' + error.message);
        },
    });

    const onSubmit = (data: AccountFormValues) => {
        createMutation.mutate(data);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link to={`/${tenant}/accounts`}>
                    <Button variant="ghost" size="icon" className="h-10 w-10">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Neues Konto</h1>
                    <p className="text-slate-500 dark:text-slate-400">Sachkonto zum Kontenplan hinzufügen</p>
                </div>
            </div>

            {/* Form */}
            <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm max-w-2xl">
                <CardHeader>
                    <CardTitle>Kontodetails</CardTitle>
                    <CardDescription>
                        Geben Sie die Details für das neue Sachkonto ein.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="code"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Kontonummer (SKR03) *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="z.B. 4900" {...field} className="bg-white dark:bg-slate-950 font-mono" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="tax_key_code"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Steuerschlüssel (Optional)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="z.B. 19" {...field} className="bg-white dark:bg-slate-950" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bezeichnung *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="z.B. Sonstige Betriebsbedarf" {...field} className="bg-white dark:bg-slate-950" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Kontenart *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-white dark:bg-slate-950">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="asset">Aktiva (Asset)</SelectItem>
                                                <SelectItem value="liability">Passiva (Liability)</SelectItem>
                                                <SelectItem value="equity">Eigenkapital (Equity)</SelectItem>
                                                <SelectItem value="revenue">Erlöse (Revenue)</SelectItem>
                                                <SelectItem value="expense">Aufwendungen (Expense)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end gap-3 pt-4">
                                <Link to={`/${tenant}/accounts`}>
                                    <Button type="button" variant="outline" className="gap-2">
                                        <X className="w-4 h-4" />
                                        Abbrechen
                                    </Button>
                                </Link>
                                <Button type="submit" disabled={createMutation.isPending} className="gap-2 shadow-lg shadow-primary/20">
                                    <Save className="w-4 h-4" />
                                    {createMutation.isPending ? 'Speichert...' : 'Konto erstellen'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
