import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const bankAccountSchema = z.object({
    name: z.string().min(1, 'Name ist erforderlich'),
    bank_name: z.string().min(1, 'Bankname ist erforderlich'),
    iban: z.string().min(15, 'Ungültige IBAN').max(34),
    bic: z.string().optional(),
    account_number: z.string().optional(),
    bank_code: z.string().optional(),
    currency: z.string().default('EUR'),
    type: z.enum(['checking', 'savings', 'credit_card']),
    is_default: z.boolean().default(false),
    notes: z.string().optional(),
});

export type BankAccountFormValues = z.infer<typeof bankAccountSchema>;

interface BankAccountFormProps {
    defaultValues?: Partial<BankAccountFormValues>;
    onSubmit: (data: BankAccountFormValues) => void;
    isSubmitting?: boolean;
}

export function BankAccountForm({ defaultValues, onSubmit, isSubmitting }: BankAccountFormProps) {
    const form = useForm<BankAccountFormValues>({
        resolver: zodResolver(bankAccountSchema),
        defaultValues: {
            name: defaultValues?.name || '',
            bank_name: defaultValues?.bank_name || '',
            iban: defaultValues?.iban || '',
            bic: defaultValues?.bic || '',
            account_number: defaultValues?.account_number || '',
            bank_code: defaultValues?.bank_code || '',
            currency: defaultValues?.currency || 'EUR',
            type: defaultValues?.type || 'checking',
            is_default: defaultValues?.is_default || false,
            notes: defaultValues?.notes || '',
        },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Kontoname *</FormLabel>
                            <FormControl>
                                <Input placeholder="z.B. Geschäftskonto" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="bank_name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Bankname *</FormLabel>
                            <FormControl>
                                <Input placeholder="z.B. Sparkasse Leipzig" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="iban"
                        render={({ field }) => (
                            <FormItem className="col-span-2">
                                <FormLabel>IBAN *</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="DE89 3704 0044 0532 0130 00"
                                        {...field}
                                        onChange={(e) => {
                                            // Remove spaces and convert to uppercase
                                            const value = e.target.value.replace(/\s/g, '').toUpperCase();
                                            field.onChange(value);
                                        }}
                                    />
                                </FormControl>
                                <FormDescription>Internationale Bankkontonummer (ohne Leerzeichen)</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="bic"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>BIC</FormLabel>
                                <FormControl>
                                    <Input placeholder="z.B. COBADEFFXXX" {...field} />
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
                                <FormLabel>Kontoart *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="checking">Girokonto</SelectItem>
                                        <SelectItem value="savings">Sparkonto</SelectItem>
                                        <SelectItem value="credit_card">Kreditkarte</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="account_number"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Kontonummer (optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Alte Kontonummer" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="bank_code"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>BLZ (optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Bankleitzahl" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Währung</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="EUR">EUR (€)</SelectItem>
                                    <SelectItem value="USD">USD ($)</SelectItem>
                                    <SelectItem value="GBP">GBP (£)</SelectItem>
                                    <SelectItem value="CHF">CHF (Fr)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Notizen</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Zusätzliche Informationen..."
                                    className="resize-none"
                                    rows={3}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="is_default"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-slate-50 dark:bg-slate-900">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                    Als Standardkonto festlegen
                                </FormLabel>
                                <FormDescription>
                                    Dieses Konto wird standardmäßig für Transaktionen verwendet
                                </FormDescription>
                            </div>
                        </FormItem>
                    )}
                />

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Speichert...' : 'Speichern'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
