import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { Mail, Building2, User, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';

export const contactSchema = z.object({
    name: z.string().min(2, 'Name muss mindestens 2 Zeichen lang sein'),
    type: z.enum(['customer', 'vendor', 'both', 'other']),
    tax_number: z.string().optional(),
    address: z.string().optional(),
    email: z.string().email('Ungültige E-Mail').optional().or(z.literal('')),
    phone: z.string().optional(),
    notice: z.string().optional(),
    bank_account: z.string().optional(),
    contact_person: z.string().optional(),
    // Fields for new account creation (only for 'other' type)
    account_code: z.string().optional(),
    account_name: z.string().optional(),
    account_type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']).optional(),
    account_id: z.string().optional(),
}).refine((data) => {
    if (data.type === 'other') {
        // If account_id is present, we assume it's an existing contact with an account
        if (data.account_id) return true;
        // Otherwise, we require the new account fields
        if (!data.account_code || !data.account_name || !data.account_type) {
            return false;
        }
    }
    return true;
}, {
    message: "Für Kontakte vom Typ 'Neutral' müssen entweder alle Kontofelder (Konto-Nr., Kontoname, Kontoart) ausgefüllt werden oder ein bestehendes Konto ausgewählt werden.",
    path: ["account_code"], // Highlight account_code field
});

export type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactFormProps {
    onSubmit: (data: ContactFormValues) => void;
    isSubmitting?: boolean;
    defaultValues?: Partial<ContactFormValues>;
}

export function ContactForm({ onSubmit, isSubmitting = false, defaultValues }: ContactFormProps) {
    const [showEmail, setShowEmail] = useState(!!defaultValues?.email);
    const [showBankAccount, setShowBankAccount] = useState(!!defaultValues?.bank_account);
    const [showContactPerson, setShowContactPerson] = useState(!!defaultValues?.contact_person);
    const [showNotice, setShowNotice] = useState(!!defaultValues?.notice);
    const [accountCodeError, setAccountCodeError] = useState<string | null>(null);
    const [checkingAccountCode, setCheckingAccountCode] = useState(false);
    const [accountSuggestions, setAccountSuggestions] = useState<{ code: string, name: string }[]>([]);
    const [nextAvailableCode, setNextAvailableCode] = useState<string | null>(null);

    const form = useForm<ContactFormValues>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: '',
            type: 'customer',
            tax_number: '',
            address: '',
            email: '',
            phone: '',
            notice: '',
            bank_account: '',
            contact_person: '',
            ...defaultValues,
        },
    });

    const { data: accounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/accounts');
            return data;
        },
    });

    // Reset account code error when type changes
    useEffect(() => {
        const subscription = form.watch((value, { name }) => {
            if (name === 'type' && value.type !== 'other') {
                setAccountCodeError(null);
                setAccountSuggestions([]);
                setNextAvailableCode(null);
            }
        });
        return () => subscription.unsubscribe();
    }, [form]);

    // Find suggestions and next available code based on prefix
    const findAccountSuggestions = (prefix: string) => {
        if (!prefix || prefix.trim() === '' || !accounts) {
            setAccountSuggestions([]);
            setNextAvailableCode(null);
            return;
        }

        // Find accounts that start with this prefix
        const matchingAccounts = accounts
            .filter((acc: any) => acc.code.toString().startsWith(prefix))
            .map((acc: any) => ({ code: acc.code.toString(), name: acc.name }))
            .sort((a: any, b: any) => a.code.localeCompare(b.code))
            .slice(-5); // Show last 5 matching accounts

        setAccountSuggestions(matchingAccounts);

        // Calculate next available code
        if (matchingAccounts.length > 0) {
            const lastCode = matchingAccounts[matchingAccounts.length - 1].code;
            const lastNumber = parseInt(lastCode, 10);
            if (!isNaN(lastNumber)) {
                const nextCode = (lastNumber + 1).toString();
                // Check if next code already exists
                const nextExists = accounts.some((acc: any) => acc.code.toString() === nextCode);
                if (!nextExists) {
                    setNextAvailableCode(nextCode);
                } else {
                    // Find next available
                    let candidate = lastNumber + 1;
                    while (accounts.some((acc: any) => acc.code.toString() === candidate.toString())) {
                        candidate++;
                    }
                    setNextAvailableCode(candidate.toString());
                }
            }
        } else {
            // No matching accounts, suggest the prefix itself if it's a number
            const prefixNum = parseInt(prefix, 10);
            if (!isNaN(prefixNum)) {
                const exists = accounts.some((acc: any) => acc.code.toString() === prefix);
                if (!exists) {
                    setNextAvailableCode(prefix);
                } else {
                    setNextAvailableCode((prefixNum + 1).toString());
                }
            }
        }
    };

    // Check if account code already exists (on blur)
    const checkAccountCode = async (code: string) => {
        if (!code || code.trim() === '') {
            setAccountCodeError(null);
            return;
        }

        setCheckingAccountCode(true);
        try {
            const account = accounts?.find((acc: any) => acc.code === code);
            if (account) {
                setAccountCodeError(`Konto-Nr. ${code} existiert bereits (${account.name})`);
            } else {
                setAccountCodeError(null);
            }
        } catch (error) {
            console.error('Error checking account code:', error);
        } finally {
            setCheckingAccountCode(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={(e) => {
                e.stopPropagation();
                form.handleSubmit(onSubmit)(e);
            }} className="space-y-4">
                {/* Required Fields */}
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name / Firma *</FormLabel>
                            <FormControl>
                                <Input {...field} />
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
                            <FormLabel>Typ *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="customer">Kunde (Debitor)</SelectItem>
                                    <SelectItem value="vendor">Lieferant (Kreditor)</SelectItem>
                                    <SelectItem value="both">Kunde & Lieferant</SelectItem>
                                    <SelectItem value="other">Sonstiges (Neutral)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Account Creation for 'other' type */}
                {form.watch('type') === 'other' && !form.watch('account_id') && (
                    <div className="space-y-4 p-4 border rounded-md bg-slate-50 dark:bg-slate-900">
                        <h4 className="font-medium text-sm">Neues Konto erstellen</h4>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="account_code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Konto-Nr. *</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                placeholder="z.B. 1300"
                                                onChange={(e) => {
                                                    field.onChange(e);
                                                    findAccountSuggestions(e.target.value);
                                                }}
                                                onBlur={(e) => {
                                                    field.onBlur();
                                                    checkAccountCode(e.target.value);
                                                    // Clear suggestions on blur after a short delay
                                                    setTimeout(() => setAccountSuggestions([]), 200);
                                                }}
                                                className={accountCodeError ? 'border-red-500' : ''}
                                            />
                                        </FormControl>

                                        {/* Account Suggestions */}
                                        {accountSuggestions.length > 0 && (
                                            <div className="mt-2 p-2 border rounded-md bg-white dark:bg-slate-800 text-xs space-y-1">
                                                <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">Vorhandene Konten:</p>
                                                {accountSuggestions.map((acc) => (
                                                    <div key={acc.code} className="flex justify-between text-slate-600 dark:text-slate-300">
                                                        <span className="font-mono">{acc.code}</span>
                                                        <span className="truncate ml-2">{acc.name}</span>
                                                    </div>
                                                ))}
                                                {nextAvailableCode && (
                                                    <div className="pt-1 mt-1 border-t border-slate-200 dark:border-slate-700">
                                                        <button
                                                            type="button"
                                                            className="w-full text-left flex justify-between items-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded px-1 py-0.5"
                                                            onClick={() => {
                                                                form.setValue('account_code', nextAvailableCode);
                                                                setAccountSuggestions([]);
                                                                setAccountCodeError(null);
                                                            }}
                                                        >
                                                            <span className="font-mono font-semibold">{nextAvailableCode}</span>
                                                            <span className="text-emerald-500">← Nächste freie Nr.</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {accountCodeError && (
                                            <p className="text-sm text-red-500">{accountCodeError}</p>
                                        )}
                                        {checkingAccountCode && (
                                            <p className="text-sm text-slate-500">Prüfe Konto-Nr...</p>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="account_type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Kontoart *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Wählen..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="asset">Aktiva (Vermögen)</SelectItem>
                                                <SelectItem value="liability">Passiva (Verbindlichkeit)</SelectItem>
                                                <SelectItem value="revenue">Erlöse (Einnahmen)</SelectItem>
                                                <SelectItem value="expense">Aufwand (Ausgaben)</SelectItem>
                                                <SelectItem value="equity">Eigenkapital</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="account_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Kontoname *</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="Name des Kontos"
                                            // Optional: Sync with contact name if empty
                                            onFocus={() => {
                                                if (!field.value) {
                                                    form.setValue('account_name', form.getValues('name'));
                                                }
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                )}

                {/* Show message if account is already assigned (Editing mode) */}
                {form.watch('type') === 'other' && form.watch('account_id') && (
                    <div className="p-4 border rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm">
                        Diesem Kontakt ist bereits ein Konto zugewiesen. Die Bearbeitung des Kontos ist hier nicht möglich.
                    </div>
                )}

                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Adresse</FormLabel>
                            <FormControl>
                                <Textarea {...field} rows={3} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="tax_number"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Steuernummer</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Telefon</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Optional Fields with Toggle Buttons */}
                <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Optionale Felder</p>
                    <div className="flex flex-wrap gap-2">
                        {!showEmail && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowEmail(true)}
                                className="gap-1"
                            >
                                <Mail className="w-3 h-3" />
                                Email
                            </Button>
                        )}
                        {!showBankAccount && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowBankAccount(true)}
                                className="gap-1"
                            >
                                <Building2 className="w-3 h-3" />
                                Bankkonto
                            </Button>
                        )}
                        {!showContactPerson && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowContactPerson(true)}
                                className="gap-1"
                            >
                                <User className="w-3 h-3" />
                                Ansprechpartner
                            </Button>
                        )}
                        {!showNotice && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowNotice(true)}
                                className="gap-1"
                            >
                                <FileText className="w-3 h-3" />
                                Notiz
                            </Button>
                        )}
                    </div>
                </div>

                {/* Conditional Optional Fields */}
                {showEmail && (
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>E-Mail</FormLabel>
                                <FormControl>
                                    <Input type="email" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {showBankAccount && (
                    <FormField
                        control={form.control}
                        name="bank_account"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bankkonto (IBAN)</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="DE89 3704 0044 0532 0130 00" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {showContactPerson && (
                    <FormField
                        control={form.control}
                        name="contact_person"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Ansprechpartner</FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {showNotice && (
                    <FormField
                        control={form.control}
                        name="notice"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notiz</FormLabel>
                                <FormControl>
                                    <Textarea {...field} rows={3} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || !!accountCodeError}
                >
                    {isSubmitting ? 'Speichert...' : 'Speichern'}
                </Button>
            </form>
        </Form>
    );
}
