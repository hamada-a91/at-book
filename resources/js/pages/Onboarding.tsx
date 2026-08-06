import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Building2, Scale, ShoppingCart, Zap, Sparkles, Rocket, ArrowRight, Loader2, Shield } from 'lucide-react';
import axios from '@/lib/axios';

interface OnboardingStatus {
    completed: boolean;
    steps: {
        company_data: boolean;
        tax_settings: boolean;
        business_model: boolean;
        legal_form: boolean;
        account_plan: boolean;
    };
}

export default function Onboarding() {
    const [currentStep, setCurrentStep] = useState(1);
    const [status, setStatus] = useState<OnboardingStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedBusinessModels, setSelectedBusinessModels] = useState<string[]>([]);
    const [selectedLegalForm, setSelectedLegalForm] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const navigate = useNavigate();
    const { tenant } = useParams();

    // Helper function for tenant-aware URLs
    const tenantUrl = (path: string) => tenant ? `/${tenant}${path}` : path;

    const businessModels = [
        {
            id: 'dienstleistungen',
            name: 'Dienstleistungen',
            icon: Zap,
            description: 'Beratung, IT, Freelancing',
            bgGradient: 'from-indigo-50 to-cyan-50 dark:from-indigo-950/20 dark:to-cyan-950/20',
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            borderColor: 'border-indigo-500'
        },
        {
            id: 'handel',
            name: 'Handel',
            icon: ShoppingCart,
            description: 'Warenverkauf, E-Commerce',
            bgGradient: 'from-indigo-50 to-cyan-50 dark:from-indigo-950/20 dark:to-cyan-950/20',
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            borderColor: 'border-indigo-500'
        },
        {
            id: 'produktion',
            name: 'Produktion',
            icon: Building2,
            description: 'Herstellung, Fertigung',
            bgGradient: 'from-indigo-50 to-cyan-50 dark:from-indigo-950/20 dark:to-cyan-950/20',
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            borderColor: 'border-indigo-500'
        },
        {
            id: 'online',
            name: 'Online-Geschäft',
            icon: Sparkles,
            description: 'PayPal, Stripe, etc.',
            bgGradient: 'from-indigo-50 to-cyan-50 dark:from-indigo-950/20 dark:to-cyan-950/20',
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            borderColor: 'border-indigo-500'
        },
        {
            id: 'offline',
            name: 'Offline-Geschäft',
            icon: Building2,
            description: 'Ladengeschäft, Büro',
            bgGradient: 'from-indigo-50 to-cyan-50 dark:from-indigo-950/20 dark:to-cyan-950/20',
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            borderColor: 'border-indigo-500'
        },
        {
            id: 'gemischt',
            name: 'Gemischt',
            icon: Rocket,
            description: 'Online + Offline',
            bgGradient: 'from-indigo-50 to-cyan-50 dark:from-indigo-950/20 dark:to-cyan-950/20',
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            borderColor: 'border-indigo-500'
        },
    ];

    const legalForms = [
        { id: 'einzelunternehmen', name: 'Einzelunternehmen', description: 'Privatentnahmen/-einlagen' },
        { id: 'gbr', name: 'GbR', description: 'Gesellschaft bürgerlichen Rechts' },
        { id: 'ohg', name: 'OHG', description: 'Offene Handelsgesellschaft' },
        { id: 'kg', name: 'KG', description: 'Kommanditgesellschaft' },
        { id: 'gmbh', name: 'GmbH', description: 'Gesellschaft mit beschränkter Haftung' },
        { id: 'ug', name: 'UG', description: 'Unternehmergesellschaft (haftungsbeschränkt)' },
        { id: 'ag', name: 'AG', description: 'Aktiengesellschaft' },
    ];

    useEffect(() => {
        checkStatus();
    }, []);

    const [error, setError] = useState<string | null>(null);

    const checkStatus = async () => {
        try {
            setError(null);
            const { data } = await axios.get('/api/onboarding/status');
            setStatus(data);

            if (data.completed) {
                navigate(tenantUrl('/dashboard'));
                return;
            }

            if (!data.steps.company_data) setCurrentStep(1);
            else if (!data.steps.business_model) setCurrentStep(2);
            else if (!data.steps.legal_form) setCurrentStep(3);
            else if (!data.steps.account_plan) setCurrentStep(4);

        } catch (error: any) {
            console.error('Error checking status:', error);
            setError('Status des Onboarding konnte nicht geladen werden. Bitte laden Sie die Seite neu.');
            if (error.response?.status === 401) {
                setError('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateAccountPlan = async () => {
        if (selectedBusinessModels.length === 0) {
            alert('Bitte wählen Sie mindestens ein Geschäftsmodell');
            return;
        }
        if (!selectedLegalForm) {
            alert('Bitte wählen Sie eine Rechtsform');
            return;
        }

        setIsGenerating(true);
        try {
            const { data: generateData } = await axios.post('/api/account-plan/generate', {
                business_models: selectedBusinessModels,
                legal_form: selectedLegalForm
            });

            alert(`Erfolgreich! ${generateData.accounts_created} Konten erstellt${generateData.accounts_skipped ? `, ${generateData.accounts_skipped} übersprungen` : ''}`);

            await axios.post('/api/onboarding/complete');

            alert('🎉 Willkommen! Onboarding erfolgreich abgeschlossen');

            setTimeout(() => {
                navigate(tenantUrl('/dashboard'));
            }, 500);

        } catch (error: any) {
            const errorMessage = error.response?.data?.message || error.message || 'Unbekannter Fehler';
            alert(`❌ Fehler: ${errorMessage}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const progress = status ? (Object.values(status.steps).filter(Boolean).length / 5) * 100 : 0;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
                <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-100 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-500"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 p-4">
                <Card className="max-w-md w-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-rose-600 dark:text-rose-400">Fehler</CardTitle>
                        <CardDescription>{error}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <button
                            onClick={() => window.location.href = '/login'}
                            className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-md shadow-indigo-500/10"
                        >
                            Zur Anmeldung
                        </button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 pb-12">
            <div className="container max-w-5xl mx-auto py-12 px-4">
                {/* Header */}
                <div className="mb-12 text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide cursor-default">
                        <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-600 dark:text-indigo-400" />
                        Setup-Assistent
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        Willkommen bei <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">AT-Book</span>
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                        Lassen Sie uns Ihr Buchführungssystem in wenigen Schritten einrichten
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-12 max-w-2xl mx-auto">
                    <div className="relative w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 transition-all duration-700 ease-out relative"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between items-center mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <p>Fortschritt: {Math.round(progress)}%</p>
                        <p>Schritt {currentStep} von 4</p>
                    </div>
                </div>

                {/* Step 1 */}
                {currentStep === 1 && (
                    <Card className="border border-slate-200/60 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 max-w-2xl mx-auto rounded-2xl">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-lg flex items-center justify-center text-white shadow-lg font-bold">
                                    1
                                </div>
                                Schritt 1: Firmendaten
                            </CardTitle>
                            <CardDescription className="text-sm">Bitte füllen Sie Ihre grundlegenden Firmendaten aus.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <button
                                onClick={() => navigate(tenantUrl('/settings?from=onboarding'))}
                                className="w-full h-12 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/10 transition-all duration-300 rounded-lg flex items-center justify-center gap-3 hover:-translate-y-0.5"
                            >
                                <Building2 className="h-5 w-5" />
                                Zu den Einstellungen
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2 */}
                {currentStep === 2 && (
                    <Card className="border border-slate-200/60 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 max-w-4xl mx-auto rounded-2xl">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-lg flex items-center justify-center text-white shadow-lg font-bold">
                                    2
                                </div>
                                Schritt 2: Geschäftsmodell auswählen
                            </CardTitle>
                            <CardDescription className="text-sm">Wählen Sie eines oder mehrere Geschäftsmodelle (Mehrfachauswahl möglich).</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {businessModels.map((model) => {
                                    const Icon = model.icon;
                                    const isSelected = selectedBusinessModels.includes(model.id);

                                    return (
                                        <div
                                            key={model.id}
                                            onClick={() => {
                                                if (isSelected) {
                                                    setSelectedBusinessModels(prev => prev.filter(id => id !== model.id));
                                                } else {
                                                    setSelectedBusinessModels(prev => [...prev, model.id]);
                                                }
                                            }}
                                            className={`relative p-5 rounded-2xl cursor-pointer border-2 transition-all duration-300 hover:scale-[1.005] ${isSelected
                                                ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 dark:border-indigo-500 shadow-md shadow-indigo-500/5'
                                                : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/30 bg-white dark:bg-slate-900'
                                                }`}
                                        >
                                            {isSelected && (
                                                <div className="absolute top-3 right-3 p-1 rounded-full bg-indigo-600 text-white shadow">
                                                    <Check className="h-3.5 w-3.5" />
                                                </div>
                                            )}
                                            <Icon className={`h-8 w-8 mb-4 ${model.iconColor} transition-transform duration-300 ${isSelected ? 'scale-105' : ''}`} />
                                            <h3 className="font-bold text-base mb-1">{model.name}</h3>
                                            <p className="text-xs text-slate-600 dark:text-slate-400">{model.description}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => setCurrentStep(3)}
                                disabled={selectedBusinessModels.length === 0}
                                className="w-full h-12 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-500/10 transition-all duration-300 rounded-lg flex items-center justify-center gap-3 hover:-translate-y-0.5"
                            >
                                Weiter zur Rechtsform
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </CardContent>
                    </Card>
                )}

                {/* Step 3 */}
                {currentStep === 3 && (
                    <Card className="border border-slate-200/60 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 max-w-2xl mx-auto rounded-2xl">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-lg flex items-center justify-center text-white shadow-lg font-bold">
                                    3
                                </div>
                                Schritt 3: Rechtsform auswählen
                            </CardTitle>
                            <CardDescription className="text-sm">Wählen Sie die Rechtsform Ihres Unternehmens.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                {legalForms.map((form) => {
                                    const isSelected = selectedLegalForm === form.id;

                                    return (
                                        <div
                                            key={form.id}
                                            onClick={() => setSelectedLegalForm(form.id)}
                                            className={`relative p-5 rounded-xl cursor-pointer border-2 transition-all duration-300 hover:scale-[1.005] ${isSelected
                                                ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 dark:border-indigo-500 shadow-md shadow-indigo-500/5'
                                                : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/30 bg-white dark:bg-slate-900'
                                                }`}
                                        >
                                            {isSelected && (
                                                <Check className="absolute top-5 right-5 h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                            )}
                                            <div className="flex items-center gap-4">
                                                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-sm shrink-0">
                                                    <Scale className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-sm">{form.name}</h3>
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{form.description}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setCurrentStep(2)}
                                    className="flex-1 h-11 font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition-all duration-300 text-sm"
                                >
                                    ← Zurück
                                </button>
                                <button
                                    onClick={() => setCurrentStep(4)}
                                    disabled={!selectedLegalForm}
                                    className="flex-1 h-11 font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-500/10 transition-all duration-300 rounded-lg flex items-center justify-center gap-2 hover:-translate-y-0.5 text-sm"
                                >
                                    Weiter zum Kontenplan
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 4 */}
                {currentStep === 4 && (
                    <Card className="border border-slate-200/60 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 max-w-2xl mx-auto rounded-2xl">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-lg flex items-center justify-center text-white shadow-lg font-bold">
                                    4
                                </div>
                                Schritt 4: Kontenplan generieren
                            </CardTitle>
                            <CardDescription className="text-sm">Ihr SKR03-konformer Kontenplan wird jetzt generiert.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                                <p className="font-bold text-sm mb-4 text-slate-900 dark:text-white">📋 Ihre Auswahl:</p>
                                <div className="space-y-3">
                                    <p className="text-xs flex items-start gap-2">
                                        <strong className="min-w-[120px]">Geschäftsmodelle:</strong>
                                        <span className="text-slate-600 dark:text-slate-400">
                                            {selectedBusinessModels.map(id => businessModels.find(m => m.id === id)?.name).join(', ')}
                                        </span>
                                    </p>
                                    <p className="text-xs flex items-start gap-2">
                                        <strong className="min-w-[120px]">Rechtsform:</strong>
                                        <span className="text-slate-600 dark:text-slate-400">
                                            {legalForms.find(f => f.id === selectedLegalForm)?.name}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setCurrentStep(3)}
                                    disabled={isGenerating}
                                    className="flex-1 h-11 font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded-lg transition-all duration-300 text-sm"
                                >
                                    ← Zurück
                                </button>
                                <button
                                    onClick={handleGenerateAccountPlan}
                                    disabled={isGenerating}
                                    className="flex-1 h-11 font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-500/10 transition-all duration-300 rounded-lg flex items-center justify-center gap-2 hover:-translate-y-0.5 text-sm"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Generiere Kontenplan...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4" />
                                            Kontenplan generieren & Abschließen
                                        </>
                                    )}
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
