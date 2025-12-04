import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Settings as SettingsIcon, Save, Upload, Building2, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface CompanySetting {
    id: number;
    company_name: string | null;
    street: string | null;
    zip: string | null;
    city: string | null;
    country: string | null;
    email: string | null;
    phone: string | null;
    tax_number: string | null;
    tax_type: 'kleinunternehmer' | 'umsatzsteuer_pflichtig';
    logo_path: string | null;
}

const settingsSchema = z.object({
    company_name: z.string().optional(),
    street: z.string().optional(),
    zip: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    email: z.string().email('Ungültige E-Mail-Adresse').optional().or(z.literal('')),
    phone: z.string().optional(),
    tax_number: z.string().optional(),
    tax_type: z.enum(['kleinunternehmer', 'umsatzsteuer_pflichtig']),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function Settings() {
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery<CompanySetting>({
        queryKey: ['settings'],
        queryFn: async () => {
            const res = await fetch('/api/settings');
            if (!res.ok) throw new Error('Fehler beim Laden der Einstellungen');
            return res.json();
        },
    });

    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            company_name: '',
            street: '',
            zip: '',
            city: '',
            country: 'Deutschland',
            email: '',
            phone: '',
            tax_number: '',
            tax_type: 'kleinunternehmer',
        },
    });

    // Update form when settings are loaded
    useEffect(() => {
        if (settings) {
            form.reset({
                company_name: settings.company_name || '',
                street: settings.street || '',
                zip: settings.zip || '',
                city: settings.city || '',
                country: settings.country || 'Deutschland',
                email: settings.email || '',
                phone: settings.phone || '',
                tax_number: settings.tax_number || '',
                tax_type: settings.tax_type,
            });
            if (settings.logo_path) {
                setLogoPreview(`/storage/${settings.logo_path}`);
            }
        }
    }, [settings, form]);

    const updateMutation = useMutation({
        mutationFn: async (data: SettingsFormValues) => {
            const formData = new FormData();
            Object.entries(data).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    formData.append(key, value as string);
                }
            });
            if (logoFile) {
                formData.append('logo', logoFile);
            }

            const res = await fetch('/api/settings', {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) throw new Error('Fehler beim Speichern');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });

    const onSubmit = (data: SettingsFormValues) => {
        updateMutation.mutate(data);
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-slate-600 dark:text-slate-400">Lade Einstellungen...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 dark:bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 dark:shadow-blue-500/20">
                    <SettingsIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Einstellungen</h1>
                    <p className="text-slate-500 dark:text-slate-400">Unternehmenseinstellungen verwalten</p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Company Address Card */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                <CardTitle>Firmendaten</CardTitle>
                            </div>
                            <CardDescription>
                                Geben Sie die Adresse Ihres Unternehmens ein
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <FormField
                                control={form.control}
                                name="company_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Firma *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="z.B. Vorpoint" {...field} className="bg-white dark:bg-slate-950" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="street"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Straße Nr. *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="z.B. Gorkistraße 84" {...field} className="bg-white dark:bg-slate-950" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="zip"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>PLZ *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="z.B. 04347" {...field} className="bg-white dark:bg-slate-950" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="city"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Ort *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="z.B. Leipzig" {...field} className="bg-white dark:bg-slate-950" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="country"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Land</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Deutschland" {...field} className="bg-white dark:bg-slate-950" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>E-Mail *</FormLabel>
                                            <FormControl>
                                                <Input type="email" placeholder="info@firma.de" {...field} className="bg-white dark:bg-slate-950" />
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
                                            <FormLabel>Telefon *</FormLabel>
                                            <FormControl>
                                                <Input type="tel" placeholder="+49 123 456789" {...field} className="bg-white dark:bg-slate-950" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="tax_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Steuernummer</FormLabel>
                                        <FormControl>
                                            <Input placeholder="z.B. 12/345/67890" {...field} className="bg-white dark:bg-slate-950" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Tax Settings Card */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                <CardTitle>Steuereinstellungen</CardTitle>
                            </div>
                            <CardDescription>
                                Wählen Sie Ihre Umsatzsteuer-Option
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <FormField
                                control={form.control}
                                name="tax_type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Umsatzsteuer-Option *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-white dark:bg-slate-950">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="kleinunternehmer">
                                                    Kleinunternehmerregelung (§19 UStG)
                                                </SelectItem>
                                                <SelectItem value="umsatzsteuer_pflichtig">
                                                    Umsatzsteuer pflichtig
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            {field.value === 'kleinunternehmer'
                                                ? 'Keine Umsatzsteuer wird berechnet'
                                                : 'Umsatzsteuer wird in Rechnungen berechnet'}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Logo Upload Card */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div className="flex items-center gap-2">
                                <Upload className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                <CardTitle>Firmenlogo</CardTitle>
                            </div>
                            <CardDescription>
                                Laden Sie Ihr Firmenlogo hoch (wird auf Rechnungen und Dokumenten angezeigt)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                {logoPreview && (
                                    <div className="flex justify-center">
                                        <img
                                            src={logoPreview}
                                            alt="Logo Vorschau"
                                            className="max-h-32 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm bg-white dark:bg-slate-950 p-2"
                                        />
                                    </div>
                                )}
                                <div className="flex items-center gap-4">
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoChange}
                                        className="cursor-pointer bg-white dark:bg-slate-950"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            size="lg"
                            className="gap-2 shadow-lg shadow-primary/20"
                            disabled={updateMutation.isPending}
                        >
                            <Save className="w-4 h-4" />
                            {updateMutation.isPending ? 'Speichert...' : 'Einstellungen speichern'}
                        </Button>
                    </div>

                    {/* Success Message */}
                    {updateMutation.isSuccess && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            Einstellungen erfolgreich gespeichert!
                        </div>
                    )}

                    {/* Error Message */}
                    {updateMutation.isError && (
                        <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-400 px-4 py-3 rounded-lg flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                            Fehler beim Speichern der Einstellungen
                        </div>
                    )}
                </form>
            </Form>
        </div>
    );
}
