/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, Building2, User, Mail, Lock, Link as LinkIcon, AlertCircle, Key, Eye, EyeOff, CheckCircle2, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Register() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
    const [isSerialNumberEnabled, setIsSerialNumberEnabled] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [formData, setFormData] = useState({
        company_name: '',
        slug: '',
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        serial_number: '',
    });

    useEffect(() => {
        axios.get('/api/config')
            .then(response => {
                setIsSerialNumberEnabled(response.data.serial_number_enabled);
            })
            .catch(error => {
                console.error('Failed to fetch config:', error);
            });
    }, []);

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    };

    const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const companyName = e.target.value;
        setFormData({
            ...formData,
            company_name: companyName,
            slug: generateSlug(companyName),
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setValidationErrors({});

        try {
            const { data } = await axios.post('/api/register', formData);

            if (data.token) {
                localStorage.setItem('auth_token', data.token);
            }

            const redirectPath = data.redirect || `/${data.tenant.slug}/onboarding`;
            window.location.href = redirectPath;
        } catch (err: any) {
            if (err.response?.status === 422 && err.response?.data?.errors) {
                setValidationErrors(err.response.data.errors);
                setError('Bitte überprüfen Sie Ihre Eingaben.');
            } else {
                setError(err.response?.data?.message || err.message || 'Bei der Registrierung ist ein Fehler aufgetreten.');
            }
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            {/* Back Button (Fixed Top-Left) */}
            <div className="absolute top-4 left-4 z-20">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => navigate('/')}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Zur Startseite
                </Button>
            </div>

            {/* Left Column: Showcase & Info Panel (Hidden on Mobile) */}
            <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white p-12 flex-col justify-between relative overflow-hidden">
                {/* Decorative glowing blobs */}
                <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-indigo-500/10 rounded-full filter blur-3xl"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-cyan-500/10 rounded-full filter blur-3xl"></div>

                {/* Logo & Brand */}
                <div className="flex items-center gap-3 z-10">
                    <img src="/atbook-logo.png" alt="AT-Book Logo" className="h-10 w-auto rounded-lg" />
                    <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
                        AT-Book
                    </span>
                </div>

                {/* High-quality content showcase */}
                <div className="max-w-md my-auto space-y-8 z-10">
                    <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
                        Starten Sie Ihre kostenlose Testphase.
                    </h2>
                    <p className="text-slate-300 text-base leading-relaxed">
                        Erstellen Sie Ihr Konto in weniger als einer Minute. Testen Sie alle Funktionen für 3 Monate kostenfrei – ganz ohne Kreditkarte.
                    </p>

                    <div className="space-y-4 pt-4">
                        <div className="flex items-start gap-3">
                            <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-white">Vollständiger Funktionsumfang</h4>
                                <p className="text-xs text-slate-400">Keine künstlichen Einschränkungen während der Testphase.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-white">Einfacher Einrichtungsassistent</h4>
                                <p className="text-xs text-slate-400">Unser Onboarding leitet Sie Schritt für Schritt an.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-white">Keine automatische Verlängerung</h4>
                                <p className="text-xs text-slate-400">Die Testphase endet automatisch nach 3 Monaten, falls Sie nicht verlängern.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer/Trust info */}
                <div className="text-xs text-slate-400 flex items-center gap-2 z-10">
                    <Shield className="h-4 w-4 text-cyan-400" />
                    <span>Rechtssicher, DSGVO-konform und täglich gesichert.</span>
                </div>
            </div>

            {/* Right Column: Register Form */}
            <div className="flex-1 md:w-1/2 lg:w-2/5 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto pt-16 md:pt-12">
                {/* Background grid for mobile decoration */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a04_1px,transparent_1px),linear-gradient(to_bottom,#0f172a04_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:3rem_3rem] md:hidden"></div>

                <div className="w-full max-w-md z-10">
                    {/* Header on mobile */}
                    <div className="flex items-center gap-2 mb-6 justify-center md:hidden">
                        <img src="/atbook-logo.png" alt="AT-Book Logo" className="h-8 w-auto rounded" />
                        <span className="font-bold text-lg text-slate-900 dark:text-white">AT-Book</span>
                    </div>

                    <Card className="border border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-xl">
                        <CardHeader className="space-y-1 pb-4">
                            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Konto erstellen
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                                3 Monate kostenlos testen. Ohne Bindung.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <Alert variant="destructive" className="bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200">
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                        <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                                    </Alert>
                                )}

                                {/* Grid layout for inputs to maintain compact form */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="company_name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Firmenname</Label>
                                        <div className="relative">
                                            <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                                            <Input
                                                id="company_name"
                                                value={formData.company_name}
                                                onChange={handleCompanyNameChange}
                                                required
                                                placeholder="Muster GmbH"
                                                disabled={loading}
                                                className={`pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 h-10 text-sm rounded-lg ${validationErrors.company_name ? 'border-rose-500' : ''}`}
                                            />
                                        </div>
                                        {validationErrors.company_name && (
                                            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">{validationErrors.company_name[0]}</p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="slug" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Firmen-URL (Kürzel)</Label>
                                        <div className="relative">
                                            <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                                            <Input
                                                id="slug"
                                                value={formData.slug}
                                                onChange={(e) => setFormData({ ...formData, slug: generateSlug(e.target.value) })}
                                                required
                                                placeholder="muster-gmbh"
                                                disabled={loading}
                                                className={`pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 h-10 text-sm rounded-lg ${validationErrors.slug ? 'border-rose-500' : ''}`}
                                            />
                                        </div>
                                        {validationErrors.slug ? (
                                            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">{validationErrors.slug[0]}</p>
                                        ) : (
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                at-book.com/{formData.slug || 'ihre-firma'}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Ihr Name</Label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                                            <Input
                                                id="name"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                required
                                                placeholder="Max Mustermann"
                                                disabled={loading}
                                                className={`pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 h-10 text-sm rounded-lg ${validationErrors.name ? 'border-rose-500' : ''}`}
                                            />
                                        </div>
                                        {validationErrors.name && (
                                            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">{validationErrors.name[0]}</p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">E-Mail-Adresse</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                                            <Input
                                                id="email"
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                required
                                                placeholder="name@firma.de"
                                                disabled={loading}
                                                className={`pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 h-10 text-sm rounded-lg ${validationErrors.email ? 'border-rose-500' : ''}`}
                                            />
                                        </div>
                                        {validationErrors.email && (
                                            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">{validationErrors.email[0]}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="serial_number" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Seriennummer (Lizenzschlüssel) *</Label>
                                    <div className="relative">
                                        <Key className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                                        <Input
                                            id="serial_number"
                                            value={formData.serial_number}
                                            onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                                            required
                                            placeholder="Lizenzschlüssel eingeben"
                                            disabled={loading}
                                            className={`pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 h-10 text-sm rounded-lg ${validationErrors.serial_number ? 'border-rose-500' : ''}`}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                                        Sie erhalten Ihre Seriennummer vom Administrator unter{' '}
                                        <a href="mailto:info@vorpoint.de" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                            info@vorpoint.de
                                        </a>.
                                    </p>
                                    {validationErrors.serial_number && (
                                        <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">{validationErrors.serial_number[0]}</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Passwort</Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                                            <Input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                required
                                                placeholder="Min. 8 Zeichen"
                                                minLength={8}
                                                disabled={loading}
                                                className={`pl-9 pr-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 h-10 text-sm rounded-lg ${validationErrors.password ? 'border-rose-500' : ''}`}
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                                                onClick={() => setShowPassword(!showPassword)}
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        {validationErrors.password && (
                                            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">{validationErrors.password[0]}</p>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="password_confirmation" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Passwort bestätigen</Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                                            <Input
                                                id="password_confirmation"
                                                type={showConfirmPassword ? "text" : "password"}
                                                value={formData.password_confirmation}
                                                onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                                                required
                                                placeholder="Passwort wiederholen"
                                                minLength={8}
                                                disabled={loading}
                                                className={`pl-9 pr-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 h-10 text-sm rounded-lg ${validationErrors.password_confirmation ? 'border-rose-500' : ''}`}
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            >
                                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-semibold text-sm rounded-lg mt-4 shadow-md shadow-indigo-500/10"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Registrierung läuft...
                                        </>
                                    ) : (
                                        'Konto erstellen'
                                    )}
                                </Button>
                            </form>
                        </CardContent>

                        <CardFooter className="justify-center border-t border-slate-200/60 dark:border-slate-800/80 pt-4 pb-4">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Bereits registriert?{' '}
                                <a href="/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors">
                                    Anmelden
                                </a>
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
