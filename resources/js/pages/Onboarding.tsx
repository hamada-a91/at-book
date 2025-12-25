import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Building2, Scale, ShoppingCart, Zap, Sparkles, Rocket, ArrowRight, Loader2 } from 'lucide-react';
import axios from 'axios';

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

    const businessModels = [
        {
            id: 'dienstleistungen',
            name: 'Dienstleistungen',
            icon: Zap,
            description: 'Beratung, IT, Freelancing',
            bgGradient: 'from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30',
            iconColor: 'text-purple-600 dark:text-purple-400',
            borderColor: 'border-purple-500'
        },
        {
            id: 'handel',
            name: 'Handel',
            icon: ShoppingCart,
            description: 'Warenverkauf, E-Commerce',
            bgGradient: 'from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30',
            iconColor: 'text-blue-600 dark:text-blue-400',
            borderColor: 'border-blue-500'
        },
        {
            id: 'produktion',
            name: 'Produktion',
            icon: Building2,
            description: 'Herstellung, Fertigung',
            bgGradient: 'from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30',
            iconColor: 'text-orange-600 dark:text-orange-400',
            borderColor: 'border-orange-500'
        },
        {
            id: 'online',
            name: 'Online-Geschäft',
            icon: Sparkles,
            description: 'PayPal, Stripe, etc.',
            bgGradient: 'from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30',
            iconColor: 'text-green-600 dark:text-green-400',
            borderColor: 'border-green-500'
        },
        {
            id: 'offline',
            name: 'Offline-Geschäft',
            icon: Building2,
            description: 'Ladengeschäft, Büro',
            bgGradient: 'from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30',
            iconColor: 'text-amber-600 dark:text-amber-400',
            borderColor: 'border-amber-500'
        },
        {
            id: 'gemischt',
            name: 'Gemischt',
            icon: Rocket,
            description: 'Online + Offline',
            bgGradient: 'from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30',
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            borderColor: 'border-indigo-500'
        },
    ];

    const legalForms = [
        { id: 'einzelunternehmen', name: 'Einzelunternehmen', description: 'Privatentnahmen/-einlagen', color: 'bg-gradient-to-r from-blue-500 to-blue-600' },
        { id: 'gbr', name: 'GbR', description: 'Gesellschaft bürgerlichen Rechts', color: 'bg-gradient-to-r from-purple-500 to-purple-600' },
        { id: 'ohg', name: 'OHG', description: 'Offene Handelsgesellschaft', color: 'bg-gradient-to-r from-pink-500 to-pink-600' },
        { id: 'kg', name: 'KG', description: 'Kommanditgesellschaft', color: 'bg-gradient-to-r from-orange-500 to-orange-600' },
        { id: 'gmbh', name: 'GmbH', description: 'Gesellschaft mit beschränkter Haftung', color: 'bg-gradient-to-r from-green-500 to-green-600' },
        { id: 'ug', name: 'UG', description: 'Unternehmergesellschaft (haftungsbeschränkt)', color: 'bg-gradient-to-r from-cyan-500 to-cyan-600' },
        { id: 'ag', name: 'AG', description: 'Aktiengesellschaft', color: 'bg-gradient-to-r from-indigo-500 to-indigo-600' },
    ];

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const { data } = await axios.get('/api/onboarding/status');
            setStatus(data);

            if (data.completed) {
                navigate('/dashboard');
                return;
            }

            if (!data.steps.company_data) setCurrentStep(1);
            else if (!data.steps.business_model) setCurrentStep(2);
            else if (!data.steps.legal_form) setCurrentStep(3);
            else if (!data.steps.account_plan) setCurrentStep(4);

        } catch (error) {
            console.error('Error checking status:', error);
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

            alert(`Erfolg! ${generateData.accounts_created} Konten erstellt${generateData.accounts_skipped ? `, ${generateData.accounts_skipped} übersprungen` : ''}`);

            await axios.post('/api/onboarding/complete');

            alert('🎉 Willkommen! Onboarding erfolgreich abgeschlossen');

            setTimeout(() => {
                navigate('/dashboard');
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
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900">
                <div className="relative">
                    <div className="animate-spin rounded-full h-20 w-20 border-4 border-purple-200 dark:border-purple-800 border-t-purple-600 dark:border-t-purple-400"></div>
                    <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-purple-600 dark:text-purple-400 animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900">
            <div className="container max-w-6xl mx-auto py-12 px-4">
                {/* Header */}
                <div className="mb-12 text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-sm font-semibold shadow-2xl shadow-purple-600/30 hover:shadow-purple-600/50 transition-all hover:scale-105 cursor-default">
                        <Sparkles className="h-5 w-5 animate-pulse" />
                        Setup-Assistant
                    </div>
                    <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                        Willkommen bei AT-Book
                    </h1>
                    <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                        Lassen Sie uns Ihr Buchführungssystem in wenigen Schritten einrichten
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-12 max-w-3xl mx-auto">
                    <div className="relative w-full h-3 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-full overflow-hidden shadow-inner">
                        <div
                            className="h-full bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 transition-all duration-700 ease-out shadow-lg relative"
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center mt-4">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Fortschritt: {Math.round(progress)}%
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Schritt {currentStep} von 4
                        </p>
                    </div>
                </div>

                {/* Step 1 */}
                {currentStep === 1 && (
                    <Card className="border-2 border-purple-200 dark:border-purple-800 shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 max-w-2xl mx-auto">
                        <CardHeader>
                            <CardTitle className="text-2xl flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white shadow-lg">
                                    1
                                </div>
                                Schritt 1: Firmendaten
                            </CardTitle>
                            <CardDescription className="text-base">Bitte füllen Sie Ihre Firmendaten aus</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <button
                                onClick={() => navigate('/settings?from=onboarding')}
                                className="w-full h-14 text-lg font-medium bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-xl shadow-purple-600/30 hover:shadow-2xl hover:shadow-purple-600/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] rounded-lg flex items-center justify-center gap-3"
                            >
                                <Building2 className="h-6 w-6" />
                                Zu den Einstellungen
                                <ArrowRight className="h-5 w-5" />
                            </button>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2 */}
                {currentStep === 2 && (
                    <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 max-w-4xl mx-auto">
                        <CardHeader>
                            <CardTitle className="text-2xl flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white shadow-lg">
                                    2
                                </div>
                                Schritt 2: Geschäftsmodell auswählen
                            </CardTitle>
                            <CardDescription className="text-base">Wählen Sie ein oder mehrere Geschäftsmodelle (Mehrfachauswahl möglich)</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                            className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-300 transform hover:scale-105 ${isSelected
                                                    ? `bg-gradient-to-br ${model.bgGradient} border-2 ${model.borderColor} shadow-xl`
                                                    : 'border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-lg bg-white dark:bg-slate-900'
                                                }`}
                                        >
                                            {isSelected && (
                                                <div className="absolute top-3 right-3 p-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg">
                                                    <Check className="h-4 w-4" />
                                                </div>
                                            )}
                                            <Icon className={`h-10 w-10 mb-4 ${model.iconColor} transition-transform duration-300 ${isSelected ? 'scale-110' : ''}`} />
                                            <h3 className="font-bold text-lg mb-2">{model.name}</h3>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">{model.description}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => setCurrentStep(3)}
                                disabled={selectedBusinessModels.length === 0}
                                className="w-full h-14 text-lg font-medium bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed text-white shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:shadow-blue-600/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 rounded-lg flex items-center justify-center gap-3"
                            >
                                Weiter zur Rechtsform
                                <ArrowRight className="h-5 w-5" />
                            </button>
                        </CardContent>
                    </Card>
                )}

                {/* Step 3 */}
                {currentStep === 3 && (
                    <Card className="border-2 border-green-200 dark:border-green-800 shadow-2xl hover:shadow-green-500/20 transition-all duration-300 backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 max-w-3xl mx-auto">
                        <CardHeader>
                            <CardTitle className="text-2xl flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center text-white shadow-lg">
                                    3
                                </div>
                                Schritt 3: Rechtsform auswählen
                            </CardTitle>
                            <CardDescription className="text-base">Wählen Sie die Rechtsform Ihres Unternehmens</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                {legalForms.map((form) => {
                                    const isSelected = selectedLegalForm === form.id;

                                    return (
                                        <div
                                            key={form.id}
                                            onClick={() => setSelectedLegalForm(form.id)}
                                            className={`relative p-5 rounded-xl cursor-pointer transition-all duration-300 transform hover:scale-[1.01] ${isSelected
                                                    ? 'bg-green-50 dark:bg-green-950/30 border-2 border-green-500 shadow-lg shadow-green-500/20'
                                                    : 'border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md bg-white dark:bg-slate-900'
                                                }`}
                                        >
                                            {isSelected && (
                                                <Check className="absolute top-5 right-5 h-6 w-6 text-green-600 dark:text-green-400" />
                                            )}
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-xl ${form.color} text-white shadow-lg transition-all duration-300`}>
                                                    <Scale className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg">{form.name}</h3>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400">{form.description}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setCurrentStep(2)}
                                    className="flex-1 h-12 font-medium border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg transition-all duration-300"
                                >
                                    ← Zurück
                                </button>
                                <button
                                    onClick={() => setCurrentStep(4)}
                                    disabled={!selectedLegalForm}
                                    className="flex-1 h-12 font-medium bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed text-white shadow-xl shadow-green-600/30 hover:shadow-2xl hover:shadow-green-600/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 rounded-lg flex items-center justify-center gap-2"
                                >
                                    Weiter zum Kontenplan
                                    <ArrowRight className="h-5 w-5" />
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 4 */}
                {currentStep === 4 && (
                    <Card className="border-2 border-orange-200 dark:border-orange-800 shadow-2xl hover:shadow-orange-500/20 transition-all duration-300 backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 max-w-3xl mx-auto">
                        <CardHeader>
                            <CardTitle className="text-2xl flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white shadow-lg">
                                    4
                                </div>
                                Schritt 4: Kontenplan generieren
                            </CardTitle>
                            <CardDescription className="text-base">Ihr SKR03-konformer Kontenplan wird jetzt generiert</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-6 rounded-xl border-2 border-slate-200 dark:border-slate-700">
                                <p className="font-semibold text-lg mb-4 text-slate-900 dark:text-white">📋 Ihre Auswahl:</p>
                                <div className="space-y-2">
                                    <p className="text-sm flex items-start gap-2">
                                        <strong className="min-w-[140px]">Geschäftsmodelle:</strong>
                                        <span className="text-slate-600 dark:text-slate-400">
                                            {selectedBusinessModels.map(id => businessModels.find(m => m.id === id)?.name).join(', ')}
                                        </span>
                                    </p>
                                    <p className="text-sm flex items-start gap-2">
                                        <strong className="min-w-[140px]">Rechtsform:</strong>
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
                                    className="flex-1 h-12 font-medium border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded-lg transition-all duration-300"
                                >
                                    ← Zurück
                                </button>
                                <button
                                    onClick={handleGenerateAccountPlan}
                                    disabled={isGenerating}
                                    className="flex-1 h-12 font-medium bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed text-white shadow-xl shadow-orange-600/30 hover:shadow-2xl hover:shadow-orange-600/40 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 rounded-lg flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Generiere Kontenplan...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-5 w-5" />
                                            Kontenplan generieren & Abschließen
                                        </>
                                    )}
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Custom shimmer animation */}
            <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
        </div>
    );
}
