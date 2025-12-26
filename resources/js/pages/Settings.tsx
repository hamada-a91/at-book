import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import axios from '@/lib/axios';
import { Settings as SettingsIcon, Save, Upload, Building2, MapPin, Mail, Phone, FileText, Image, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccountPlanManagement } from '@/components/AccountPlanManagement';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    company_name: z.string().min(2, 'Firmenname muss mindestens 2 Zeichen lang sein').max(100, 'Firmenname darf maximal 100 Zeichen lang sein'),
    street: z.string().min(3, 'Straße muss mindestens 3 Zeichen lang sein'),
    zip: z.string().min(4, 'PLZ muss mindestens 4 Zeichen lang sein').max(10, 'PLZ darf maximal 10 Zeichen lang sein'),
    city: z.string().min(2, 'Stadt muss mindestens 2 Zeichen lang sein'),
    country: z.string().min(2, 'Land ist erforderlich'),
    email: z.string().email('Bitte geben Sie eine gültige E-Mail-Adresse ein'),
    phone: z.string().min(5, 'Telefonnummer muss mindestens 5 Zeichen lang sein'),
    tax_number: z.string().optional(),
    tax_type: z.enum(['kleinunternehmer', 'umsatzsteuer_pflichtig']),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function Settings() {
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoError, setLogoError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { tenant } = useParams();
    const fromOnboarding = searchParams.get('from') === 'onboarding';

    // Helper function for tenant-aware URLs
    const tenantUrl = (path: string) => tenant ? `/${tenant}${path}` : path;

    const { data: settings, isLoading } = useQuery<CompanySetting>({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data } = await axios.get('/api/settings');
            return data;
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
                tax_type: settings.tax_type || 'kleinunternehmer',
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

            const { data: responseData } = await axios.post('/api/settings', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return responseData;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            setLogoFile(null);
            setSaveSuccess(true);
            setLogoError(null); // Clear any previous logo errors

            if (fromOnboarding) {
                // Redirect back to onboarding after a short delay to show success message
                setTimeout(() => {
                    navigate(tenantUrl('/onboarding'));
                }, 1500);
            } else {
                // Just show success message for 3 seconds
                setTimeout(() => setSaveSuccess(false), 3000);
            }
        },
        onError: (error: any) => {
            if (error.response && error.response.status === 422) {
                const errors = error.response.data.errors;

                // Handle logo errors specifically since it's not a registered form field
                if (errors.logo) {
                    setLogoError(Array.isArray(errors.logo) ? errors.logo[0] : errors.logo);
                }

                // Handle other form field errors
                Object.keys(errors).forEach((key) => {
                    if (key !== 'logo') {
                        // Cast key to keyof SettingsFormValues to satisfy TypeScript
                        form.setError(key as keyof SettingsFormValues, {
                            type: 'manual',
                            message: Array.isArray(errors[key]) ? errors[key][0] : errors[key],
                        });
                    }
                });
            } else {
                // Handle generic errors
                console.error('Settings update error:', error);
            }
        },
    });

    const onSubmit = (data: SettingsFormValues) => {
        updateMutation.mutate(data);
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setLogoError(null);

        if (file) {
            // Validate file type
            if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
                setLogoError('Bitte laden Sie nur Bilder hoch (JPEG, PNG, WebP)');
                e.target.value = '';
                return;
            }

            // Validate file size
            if (file.size > MAX_FILE_SIZE) {
                setLogoError('Die Datei ist zu groß. Maximale Größe: 5MB');
                e.target.value = '';
                return;
            }

            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeLogo = () => {
        setLogoFile(null);
        setLogoPreview(null);
        setLogoError(null);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
                    <p className="text-slate-600 dark:text-slate-400">Laden der Einstellungen...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="relative">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/30 dark:shadow-blue-500/30">
                        <SettingsIcon className="w-7 h-7 text-white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-slate-900"></div>
                </div>
                <div className="flex-1">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                        Einstellungen
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Verwalten Sie Ihre Unternehmenseinstellungen</p>
                </div>
            </div>

            {/* Success Message */}
            {saveSuccess && (
                <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 animate-in slide-in-from-top duration-300">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                        ✅ Einstellungen wurden erfolgreich gespeichert!
                        {fromOnboarding && <span className="ml-2">Weiterleitung zum Onboarding...</span>}
                    </AlertDescription>
                </Alert>
            )}

            {/* Onboarding Banner */}
            {fromOnboarding && (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 p-1 shadow-2xl">
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">🚀</span>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Onboarding - Schritt 1 von 4</h3>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400">
                                    Geben Sie Ihre Firmendaten ein und klicken Sie auf <strong>"Speichern"</strong>, um fortzufahren
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(tenantUrl('/onboarding'))}
                                className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                            >
                                ← Zurück
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Logo Upload Card */}
                    <Card className="shadow-lg border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all duration-300">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                                    <Image className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">Firmenlogo</CardTitle>
                                    <CardDescription>Laden Sie Ihr Firmenlogo hoch (Max. 5MB, nur Bilder)</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-6">
                                {/* Preview */}
                                <div className="flex-shrink-0">
                                    {logoPreview ? (
                                        <div className="relative group">
                                            <img
                                                src={logoPreview}
                                                alt="Logo Vorschau"
                                                className="w-32 h-32 object-contain rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-md"
                                            />
                                            <button
                                                type="button"
                                                onClick={removeLogo}
                                                className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-32 h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-900/50">
                                            <Image className="w-12 h-12 text-slate-400" />
                                        </div>
                                    )}
                                </div>

                                {/* Upload Button */}
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <label htmlFor="logo-upload">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                                                onClick={() => document.getElementById('logo-upload')?.click()}
                                            >
                                                <Upload className="w-4 h-4 mr-2" />
                                                Logo hochladen
                                            </Button>
                                        </label>
                                        <input
                                            id="logo-upload"
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,image/webp"
                                            onChange={handleLogoChange}
                                            className="hidden"
                                        />
                                    </div>

                                    {logoError && (
                                        <Alert variant="destructive" className="animate-in slide-in-from-top duration-300">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>{logoError}</AlertDescription>
                                        </Alert>
                                    )}

                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Unterstützte Formate: JPEG, PNG, WebP<br />
                                        Maximale Dateigröße: 5MB
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Company Information Card */}
                    <Card className="shadow-lg border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all duration-300">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">Firmendaten</CardTitle>
                                    <CardDescription>Grundlegende Informationen zu Ihrem Unternehmen</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <FormField
                                control={form.control}
                                name="company_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-medium">Firmenname *</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                placeholder="z.B. Mustermann GmbH"
                                                className="h-11 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-medium">E-Mail *</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <Input
                                                        {...field}
                                                        type="email"
                                                        placeholder="info@firma.de"
                                                        className="h-11 pl-10 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage className="text-xs" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-medium">Telefon *</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <Input
                                                        {...field}
                                                        type="tel"
                                                        placeholder="+49 123 456789"
                                                        className="h-11 pl-10 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage className="text-xs" />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Address Card */}
                    <Card className="shadow-lg border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all duration-300">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">Adresse</CardTitle>
                                    <CardDescription>Ihre Firmenadresse</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <FormField
                                control={form.control}
                                name="street"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-medium">Straße & Hausnummer *</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                placeholder="Musterstraße 123"
                                                className="h-11 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField
                                    control={form.control}
                                    name="zip"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-medium">PLZ *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="10115"
                                                    className="h-11 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                                                />
                                            </FormControl>
                                            <FormMessage className="text-xs" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="city"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel className="text-sm font-medium">Stadt *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="Berlin"
                                                    className="h-11 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                                                />
                                            </FormControl>
                                            <FormMessage className="text-xs" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="country"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-medium">Land *</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                placeholder="Deutschland"
                                                className="h-11 border-slate-300 dark:border-slate-700 focus:border-green-500 dark:focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Tax Information Card */}
                    <Card className="shadow-lg border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all duration-300">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">Steuerinformationen</CardTitle>
                                    <CardDescription>Steuernummer und Steuerart</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <FormField
                                control={form.control}
                                name="tax_number"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-medium">Steuernummer</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                placeholder="DE123456789"
                                                className="h-11 border-slate-300 dark:border-slate-700 focus:border-orange-500 dark:focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="tax_type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-medium">Steuerart *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-11 border-slate-300 dark:border-slate-700 focus:border-orange-500 dark:focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all">
                                                    <SelectValue placeholder="Steuerart wählen" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="kleinunternehmer">Kleinunternehmer (§19 UStG)</SelectItem>
                                                <SelectItem value="umsatzsteuer_pflichtig">Umsatzsteuerpflichtig</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormDescription className="text-xs">
                                            Wählen Sie die zutreffende Steuerart für Ihr Unternehmen
                                        </FormDescription>
                                        <FormMessage className="text-xs" />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Save Button */}
                    <div className="flex justify-end gap-3 pt-4">
                        {fromOnboarding && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate(tenantUrl('/onboarding'))}
                                className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                            >
                                Abbrechen
                            </Button>
                        )}
                        <Button
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all duration-300 px-8 h-11"
                        >
                            {updateMutation.isPending ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                    Speichern...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Einstellungen speichern
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </Form>

            {/* Account Plan Management - Only show when not in onboarding */}
            {!fromOnboarding && (
                <div className="mt-12">
                    <AccountPlanManagement />
                </div>
            )}
        </div>
    );
}
