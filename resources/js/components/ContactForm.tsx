import React, { useState } from 'react';
import { Plus, Mail, Building2, User, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm, UseFormReturn } from 'react-hook-form';
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

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <p className="text-sm font-medium text-slate-700 mb-3">Optionale Felder</p>
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

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Speichert...' : 'Speichern'}
                </Button>
            </form>
        </Form>
    );
}
