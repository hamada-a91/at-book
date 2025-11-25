import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
            const res = await fetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Fehler beim Erstellen');
            }

            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            navigate('/accounts');
        },
        onError: (error: Error) => {
            alert('Fehler: ' + error.message);
        },
    });

    const onSubmit = (data: AccountFormValues) => {
        createMutation.mutate(data);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="container mx-auto py-8 px-4">
                {/* Header */}
                <div className="mb-6">
                    <Link to="/accounts" className="text-blue-600 hover:underline mb-2 inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Zurück zum Kontenplan
                    </Link>
                    <h1 className="text-4xl font-bold text-slate-900">Neues Konto</h1>
                    <p className="text-slate-600">Sachkonto zum Kontenplan hinzufügen</p>
                </div>

                {/* Form */}
                <Card className="shadow-lg max-w-2xl mx-auto">
                    <CardContent className="p-6">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="code"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Kontonummer (SKR03) *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="z.B. 4900" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Bezeichnung *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="z.B. Sonstige Betriebsbedarf" {...field} />
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
                                                    <SelectTrigger>
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

                                <FormField
                                    control={form.control}
                                    name="tax_key_code"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Steuerschlüssel (Optional)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="z.B. 19" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="flex gap-3 pt-4">
                                    <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                                        {createMutation.isPending ? 'Speichert...' : 'Konto erstellen'}
                                    </Button>
                                    <Link to="/accounts" className="flex-1">
                                        <Button type="button" variant="outline" className="w-full">
                                            Abbrechen
                                        </Button>
                                    </Link>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
