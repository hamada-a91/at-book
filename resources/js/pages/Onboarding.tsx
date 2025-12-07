import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Building2, Scale, ShoppingCart, Zap, Sparkles, Rocket, ArrowRight } from 'lucide-react';
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
    const [searchParams, setSearchParams] = useSearchParams();

    const businessModels = [
        {
            id: 'dienstleistungen',
            name: 'Dienstleistungen',
            icon: Zap,
            description: 'Beratung, IT, Freelancing',
            gradient: 'from-purple-500 to-pink-500',
            bgGradient: 'from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50',
            iconColor: 'text-purple-600 dark:text-purple-400'
        },
        {
            id: 'handel',
            name: 'Handel',
            icon: ShoppingCart,
            description: 'Warenverkauf, E-Commerce',
            gradient: 'from-blue-500 to-cyan-500',
            bgGradient: 'from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50',
            iconColor: 'text-blue-600 dark:text-blue-400'
        },
        {
            id: 'produktion',
            name: 'Produktion',
            icon: Building2,
            description: 'Herstellung, Fertigung',
            gradient: 'from-orange-500 to-red-500',
            bgGradient: 'from-orange-50 to-red-50 dark:from-orange-950/50 dark:to-red-950/50',
            iconColor: 'text-orange-600 dark:text-orange-400'
        },
        {
            id: 'online',
            name: 'Online-Geschäft',
            icon: Sparkles,
            description: 'PayPal, Stripe, etc.',
            gradient: 'from-green-500 to-emerald-500',
            bgGradient: 'from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50',
            iconColor: 'text-green-600 dark:text-green-400'
        },
        {
            id: 'offline',
            name: 'Offline-Geschäft',
            icon: Building2,
            description: 'Ladengeschäft, Büro',
            gradient: 'from-amber-500 to-yellow-500',
            bgGradient: 'from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50',
            iconColor: 'text-amber-600 dark:text-amber-400'
        },
        {
            id: 'gemischt',
            name: 'Gemischt',
            icon: Rocket,
            description: 'Online + Offline',
            gradient: 'from-indigo-500 to-purple-500',
            bgGradient: 'from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50',
            iconColor: 'text-indigo-600 dark:text-indigo-400'
        },
    ];

    const legalForms = [
        { id: 'einzelunternehmen', name: 'Einzelunternehmen', description: 'Privatentnahmen/-einlagen', color: 'bg-blue-500' },
        { id: 'gbr', name: 'GbR', description: 'Gesellschaft bürgerlichen Rechts', color: 'bg-purple-500' },
        { id: 'ohg', name: 'OHG', description: 'Offene Handelsgesellschaft', color: 'bg-pink-500' },
        { id: 'kg', name: 'KG', description: 'Kommanditgesellschaft', color: 'bg-orange-500' },
        { id: 'gmbh', name: 'GmbH', description: 'Gesellschaft mit beschränkter Haftung', color: 'bg-green-500' },
        { id: 'ug', name: 'UG', description: 'Unternehmergesellschaft (haftungsbeschränkt)', color: 'bg-cyan-500' },
        { id: 'ag', name: 'AG', description: 'Aktiengesellschaft', color: 'bg-indigo-500' },
    ];

    useEffect(() => {
        checkStatus();

        // Clear the 'refresh' parameter after checking status
        if (searchParams.get('refresh')) {
            setSearchParams({});
        }
    }, [searchParams.get('refresh')]);

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
            console.log('🚀 Starte Kontenplan-Generierung...', {
                business_models: selectedBusinessModels,
                legal_form: selectedLegalForm
            });

            const { data: generateData } = await axios.post('/api/account-plan/generate', {
                business_models: selectedBusinessModels,
                legal_form: selectedLegalForm
            });

            console.log('✅ Kontenplan generiert:', generateData);
            alert(`Erfolg! ${generateData.accounts_created} Konten erstellt${generateData.accounts_skipped ? `, ${generateData.accounts_skipped} übersprungen` : ''}`);

            console.log('📝 Versuche Onboarding abzuschließen...');
            const { data: completeData } = await axios.post('/api/onboarding/complete');

            console.log('✅ Onboarding abgeschlossen:', completeData);
            alert('🎉 Willkommen! Onboarding erfolgreich abgeschlossen');

            console.log('🏠 Weiterleitung zum Dashboard...');
            setTimeout(() => {
                navigate('/dashboard');
            }, 500);

        } catch (error: any) {
            console.error('❌ Fehler beim Onboarding:', error);

            const errorMessage = error.response?.data?.message || error.message || 'Unbekannter Fehler';
            const errorStep = error.response?.data?.step;

            alert(`❌ Fehler: ${errorMessage}${errorStep ? ` (Schritt: ${errorStep})` : ''}`);

            console.error('Full error details:', {
                message: errorMessage,
                step: errorStep,
                response: error.response?.data,
                status: error.response?.status
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const progress = status ? (Object.values(status.steps).filter(Boolean).length / 5) * 100 : 0;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900">
                <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600"></div>
                    <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-purple-600 animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900">
            <div className="container max-w-5xl mx-auto py-12 px-4">
                {/* Header */}
                <div className="mb-10 text-center">
                    <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-sm font-semibold shadow-lg">
                        <Sparkles className="h-4 w-4" />
                        Setup-Assistent
                    </div>
                    <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                        Willkommen bei AT-Book
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-300">
                        Lassen Sie uns Ihr Buchführungssystem einrichten
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-10">
                    <div className="relative w-full h-4 bg-white dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                        <div
                            className="h-full bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                            Fortschritt: {Math.round(progress)}%
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Schritt {currentStep} von 4
                        </p>
                    </div>
                </div>

                {/* Step 1 */}
                {currentStep === 1 && (
                    <Card className="border-2 border-purple-200 dark:border-purple-800 shadow-2xl">
                        <CardHeader>
                            <CardTitle>Schritt 1: Firmendaten</CardTitle>
                            <CardDescription>Bitte füllen Sie Ihre Firmendaten aus</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => navigate('/settings?from=onboarding')} className="w-full">
                                <Building2 className="mr-2 h-5 w-5" />
                                Zu den Einstellungen
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2 */}
                {currentStep === 2 && (
                    <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-2xl">
                        <CardHeader>
                            <CardTitle>Schritt 2: Geschäftsmodell auswählen</CardTitle>
                            <CardDescription>Wählen Sie ein oder mehrere Geschäftsmodelle</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                            className={`relative p-6 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-gradient-to-br ' + model.bgGradient + ' border-2 border-primary' : 'border-2 border-border hover:border-primary/50'
                                                }`}
                                        >
                                            {isSelected && (
                                                <div className="absolute top-3 right-3 p-1 rounded-full bg-primary">
                                                    <Check className="h-4 w-4 text-white" />
                                                </div>
                                            )}
                                            <Icon className={`h-8 w-8 mb-3 ${model.iconColor}`} />
                                            <h3 className="font-bold mb-1">{model.name}</h3>
                                            <p className="text-sm text-muted-foreground">{model.description}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            <Button
                                onClick={() => setCurrentStep(3)}
                                disabled={selectedBusinessModels.length === 0}
                                className="w-full"
                            >
                                Weiter zur Rechtsform
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Step 3 */}
                {currentStep === 3 && (
                    <Card className="border-2 border-green-200 dark:border-green-800 shadow-2xl">
                        <CardHeader>
                            <CardTitle>Schritt 3: Rechtsform auswählen</CardTitle>
                            <CardDescription>Wählen Sie Ihre Unternehmensform</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                {legalForms.map((form) => {
                                    const isSelected = selectedLegalForm === form.id;

                                    return (
                                        <div
                                            key={form.id}
                                            onClick={() => setSelectedLegalForm(form.id)}
                                            className={`relative p-4 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-green-50 dark:bg-green-950/30 border-2 border-green-500' : 'border-2 border-border hover:border-green-300'
                                                }`}
                                        >
                                            {isSelected && (
                                                <Check className="absolute top-4 right-4 h-5 w-5 text-green-600" />
                                            )}
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded ${form.color}`}>
                                                    <Scale className="h-5 w-5 text-white" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold">{form.name}</h3>
                                                    <p className="text-sm text-muted-foreground">{form.description}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                                    Zurück
                                </Button>
                                <Button
                                    onClick={() => setCurrentStep(4)}
                                    disabled={!selectedLegalForm}
                                    className="flex-1"
                                >
                                    Weiter zum Kontenplan
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 4 */}
                {currentStep === 4 && (
                    <Card className="border-2 border-orange-200 dark:border-orange-800 shadow-2xl">
                        <CardHeader>
                            <CardTitle>Schritt 4: Kontenplan generieren</CardTitle>
                            <CardDescription>Ihr SKR03-konformer Kontenplan wird jetzt generiert</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-muted p-4 rounded-lg">
                                <p className="font-semibold mb-2">Ihre Auswahl:</p>
                                <p className="text-sm"><strong>Geschäftsmodelle:</strong> {selectedBusinessModels.map(id =>
                                    businessModels.find(m => m.id === id)?.name
                                ).join(', ')}</p>
                                <p className="text-sm"><strong>Rechtsform:</strong> {
                                    legalForms.find(f => f.id === selectedLegalForm)?.name
                                }</p>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setCurrentStep(3)} className="flex-1">
                                    Zurück
                                </Button>
                                <Button
                                    onClick={handleGenerateAccountPlan}
                                    disabled={isGenerating}
                                    className="flex-1"
                                >
                                    {isGenerating ? 'Generiere...' : 'Kontenplan generieren & Abschließen'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
