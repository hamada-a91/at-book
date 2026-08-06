import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowLeft, Mail, Lock, Eye, EyeOff, CheckCircle2, Shield } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        remember: false,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { data } = await axios.post('/api/login', formData);

            if (data.token) {
                localStorage.setItem('auth_token', data.token);
            }

            if (data.redirect) {
                navigate(data.redirect);
            } else {
                navigate(`/${data.tenant.slug}/dashboard`);
            }
        } catch (err: any) {
            const status = err.response?.status;
            const message = err.response?.data?.message;

            if (status === 401) {
                setError('E-Mail oder Passwort ist falsch. Demo-Login: demo@at-book.local / password');
            } else if (status === 429) {
                setError(message || 'Zu viele Login-Versuche. Bitte warten und erneut versuchen.');
            } else if (status === 422) {
                setError('Bitte E-Mail und Passwort prüfen.');
            } else {
                setError(message || err.message || 'Login fehlgeschlagen. Bitte erneut versuchen.');
            }
        } finally {
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

            {/* Left Column: Brand & Value Prop Showcase (Hidden on Mobile) */}
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
                        Die Buchhaltungs-Plattform für wachsende Unternehmen.
                    </h2>
                    <p className="text-slate-300 text-base leading-relaxed">
                        Nutzen Sie integrierte Automatisierungen und behalten Sie Ihre Steuern und Finanzen immer sicher und GoBD-konform im Griff.
                    </p>

                    <div className="space-y-4 pt-4">
                        <div className="flex items-start gap-3">
                            <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-white">Intelligenter OCR-Beleg-Scan</h4>
                                <p className="text-xs text-slate-400">Automatische Datenerfassung spart Zeit und Fehler.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-white">Automatisierter Bankabgleich</h4>
                                <p className="text-xs text-slate-400">Direkter Kontenabgleich mit passenden Buchungsvorschlägen.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-white">Echtzeit BWA, GuV & EÜR</h4>
                                <p className="text-xs text-slate-400">Auswertungen auf Knopfdruck, jederzeit bereit für ELSTER.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer/Trust info */}
                <div className="text-xs text-slate-400 flex items-center gap-2 z-10">
                    <Shield className="h-4 w-4 text-cyan-400" />
                    <span>GoBD-konform & DSGVO-geschützt. Alle Daten liegen auf deutschen Servern.</span>
                </div>
            </div>

            {/* Right Column: Login Form */}
            <div className="flex-1 md:w-1/2 lg:w-2/5 flex items-center justify-center p-6 sm:p-12 relative">
                {/* Background grid for mobile decoration */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a04_1px,transparent_1px),linear-gradient(to_bottom,#0f172a04_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:3rem_3rem] md:hidden"></div>

                <div className="w-full max-w-md z-10">
                    {/* Header on mobile */}
                    <div className="flex items-center gap-2 mb-8 justify-center md:hidden">
                        <img src="/atbook-logo.png" alt="AT-Book Logo" className="h-8 w-auto rounded" />
                        <span className="font-bold text-lg text-slate-900 dark:text-white">AT-Book</span>
                    </div>

                    <Card className="border border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-xl">
                        <CardHeader className="space-y-1 pb-6">
                            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Willkommen zurück
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                                Melden Sie sich an, um Ihr Cockpit zu öffnen.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <Alert variant="destructive" className="bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200">
                                        <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                                    </Alert>
                                )}

                                {/* Demo credentials alert block */}
                                <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-indigo-800 dark:border-indigo-950/50 dark:bg-indigo-950/20 dark:text-indigo-300">
                                    <span className="font-bold">Test-Zugang:</span> <span className="font-mono bg-indigo-100/50 dark:bg-indigo-900/30 px-1 py-0.5 rounded">demo@at-book.local</span> mit Passwort <span className="font-mono bg-indigo-100/50 dark:bg-indigo-900/30 px-1 py-0.5 rounded">password</span>
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
                                            className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 h-10 text-sm rounded-lg"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Passwort</Label>
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required
                                            placeholder="••••••••"
                                            disabled={loading}
                                            className="pl-9 pr-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 h-10 text-sm rounded-lg"
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2 pt-1">
                                    <Checkbox
                                        id="remember"
                                        checked={formData.remember}
                                        onCheckedChange={(checked) =>
                                            setFormData({ ...formData, remember: checked as boolean })
                                        }
                                        disabled={loading}
                                        className="border-slate-300 dark:border-slate-700 data-[state=checked]:bg-indigo-600 data-[state=checked]:text-white"
                                    />
                                    <label
                                        htmlFor="remember"
                                        className="text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer select-none"
                                    >
                                        Angemeldet bleiben
                                    </label>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-semibold text-sm rounded-lg mt-2 shadow-md shadow-indigo-500/10"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Anmeldung läuft...
                                        </>
                                    ) : (
                                        'Anmelden'
                                    )}
                                </Button>
                            </form>
                        </CardContent>

                        <CardFooter className="justify-center border-t border-slate-200/60 dark:border-slate-800/80 pt-4 pb-4">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Noch kein Konto?{' '}
                                <a href="/register" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors">
                                    Kostenlos registrieren
                                </a>
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
