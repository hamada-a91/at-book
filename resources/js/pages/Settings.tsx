import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigation } from '@/components/Layout/Navigation';
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
    tax_type: 'kleinunternehmer' | 'umsatzsteuer_pflichtig';
    logo_path: string | null;
}

const settingsSchema = z.object({
    company_name: z.string().optional(),
    street: z.string().optional(),
    zip: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
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
            <Navigation>
                <div className="flex items-center justify-center h-64">
                    <p className="text-slate-600">Lade Einstellungen...</p>
                </div>
            </Navigation>
        );
    }

    return (
        <Navigation>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                        <SettingsIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold text-slate-900">Einstellungen</h1>
                        <p className="text-slate-600">Unternehmenseinstellungen verwalten</p>
                    </div>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {/* Company Address Card */}
                        <Card className="shadow-lg border-slate-200">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50">
                                <div className="flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-blue-600" />
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
                                                <Input placeholder="z.B. Vorpoint" {...field} />
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
                                                <Input placeholder="z.B. Gorkistraße 84" {...field} />
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
                                                    <Input placeholder="z.B. 04347" {...field} />
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
                                                    <Input placeholder="z.B. Leipzig" {...field} />
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
                                                <Input placeholder="Deutschland" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Tax Settings Card */}
                        <Card className="shadow-lg border-slate-200">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-green-50">
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-green-600" />
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
                                                    <SelectTrigger>
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
                        <Card className="shadow-lg border-slate-200">
                            <CardHeader className="bg-gradient-to-r from-slate-50 to-purple-50">
                                <div className="flex items-center gap-2">
                                    <Upload className="w-5 h-5 text-purple-600" />
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
                                                className="max-h-32 border border-slate-200 rounded-lg shadow-sm"
                                            />
                                        </div>
                                    )}
                                    <div className="flex items-center gap-4">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoChange}
                                            className="cursor-pointer"
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
                                className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
                                disabled={updateMutation.isPending}
                            >
                                <Save className="w-4 h-4" />
                                {updateMutation.isPending ? 'Speichert...' : 'Einstellungen speichern'}
                            </Button>
                        </div>

                        {/* Success Message */}
                        {updateMutation.isSuccess && (
                            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                                ✓ Einstellungen erfolgreich gespeichert!
                            </div>
                        )}

                        {/* Error Message */}
                        {updateMutation.isError && (
                            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                                ✗ Fehler beim Speichern der Einstellungen
                            </div>
                        )}
                    </form>
                </Form>
            </div>
        </Navigation>
    );
}
