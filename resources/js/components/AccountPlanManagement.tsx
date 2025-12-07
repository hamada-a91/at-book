import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, Check, Package, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AccountPlanStatus {
    initialized: boolean;
    initialized_at?: string;
    last_updated_at?: string;
    business_models?: string[];
    legal_form?: string;
    total_accounts?: number;
    generated_accounts?: number;
}

interface MissingAccount {
    code: string;
    name: string;
    category: string;
}

export function AccountPlanManagement() {
    const [status, setStatus] = useState<AccountPlanStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showExtendDialog, setShowExtendDialog] = useState(false);
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [missingAccounts, setMissingAccounts] = useState<MissingAccount[]>([]);
    const [isExtending, setIsExtending] = useState(false);
    const [previewModel, setPreviewModel] = useState<string | null>(null);

    const businessModels = [
        { id: 'dienstleistungen', name: 'Dienstleistungen', description: 'Beratung, IT, Freelancing' },
        { id: 'handel', name: 'Handel', description: 'Warenverkauf, E-Commerce' },
        { id: 'produktion', name: 'Produktion', description: 'Herstellung, Fertigung' },
        { id: 'online', name: 'Online-Geschäft', description: 'PayPal, Stripe, etc.' },
        { id: 'offline', name: 'Offline-Geschäft', description: 'Ladengeschäft, Büro' },
        { id: 'gemischt', name: 'Gemischt', description: 'Online + Offline' },
    ];

    const legalFormLabels: Record<string, string> = {
        einzelunternehmen: 'Einzelunternehmen',
        gbr: 'GbR',
        ohg: 'OHG',
        kg: 'KG',
        gmbh: 'GmbH',
        ug: 'UG',
        ag: 'AG',
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const { data } = await axios.get('/api/account-plan/status');
            setStatus(data);
        } catch (error) {
            console.error('Error fetching status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMissingAccounts = async (model: string) => {
        try {
            const { data } = await axios.get(`/api/account-plan/missing?model=${model}`);
            setMissingAccounts(data.missing_accounts || []);
            setPreviewModel(model);
        } catch (error) {
            console.error('Error fetching missing accounts:', error);
        }
    };

    const handleExtend = async () => {
        if (selectedModels.length === 0) return;

        setIsExtending(true);
        try {
            const { data } = await axios.post('/api/account-plan/extend', {
                add_business_models: selectedModels
            });

            alert(`Erfolg! ${data.added_accounts} neue Konten hinzugefügt.`);
            setShowExtendDialog(false);
            setSelectedModels([]);
            setPreviewModel(null);
            setMissingAccounts([]);
            fetchStatus();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Fehler beim Erweitern');
        } finally {
            setIsExtending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!status || !status.initialized) {
        return (
            <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                    Kontenplan noch nicht initialisiert. Bitte schließen Sie das Onboarding ab.
                </p>
            </div>
        );
    }

    const availableModels = businessModels.filter(
        m => !status.business_models?.includes(m.id)
    );

    return (
        <div className="space-y-6">
            {/* Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-2 border-primary/20 hover:border-primary/40 transition-colors">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-lg bg-primary/10">
                                <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Rechtsform</p>
                                <p className="font-semibold">{legalFormLabels[status.legal_form || ''] || 'Unbekannt'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
                                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Konten</p>
                                <p className="font-semibold">{status.total_accounts} (<span className="text-blue-600 dark:text-blue-400">{status.generated_accounts} generiert</span>)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 transition-colors">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
                                <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Initialisiert</p>
                                <p className="font-semibold text-sm">
                                    {status.initialized_at ? new Date(status.initialized_at).toLocaleDateString('de-DE') : 'N/A'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Active Business Models */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Aktive Geschäftsmodelle
                    </CardTitle>
                    <CardDescription>
                        Ihre aktuell aktivierten Geschäftsmodelle und Kontenstrukturen
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {status.business_models?.map((modelId) => {
                            const model = businessModels.find(m => m.id === modelId);
                            return (
                                <Badge key={modelId} variant="secondary" className="px-4 py-2 text-sm">
                                    <Check className="h-3 w-3 mr-2" />
                                    {model?.name || modelId}
                                </Badge>
                            );
                        })}
                    </div>

                    {status.last_updated_at && (
                        <p className="text-xs text-muted-foreground mt-4">
                            Zuletzt erweitert: {new Date(status.last_updated_at).toLocaleDateString('de-DE')}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Extend Account Plan */}
            {availableModels.length > 0 && (
                <Card className="border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors">
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <Plus className="h-10 w-10 mx-auto text-primary mb-3" />
                            <h3 className="font-semibold mb-2">Kontenplan erweitern</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Fügen Sie weitere Geschäftsmodelle hinzu, ohne bestehende Konten zu ändern
                            </p>
                            <Button onClick={() => setShowExtendDialog(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Geschäftsmodell hinzufügen
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Extension Dialog */}
            <Dialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Kontenplan erweitern</DialogTitle>
                        <DialogDescription>
                            Wählen Sie zusätzliche Geschäftsmodelle. Bestehende Konten bleiben unverändert.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Model Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {availableModels.map((model) => {
                                const isSelected = selectedModels.includes(model.id);

                                return (
                                    <div
                                        key={model.id}
                                        onClick={() => {
                                            if (isSelected) {
                                                setSelectedModels(prev => prev.filter(id => id !== model.id));
                                                if (previewModel === model.id) {
                                                    setPreviewModel(null);
                                                    setMissingAccounts([]);
                                                }
                                            } else {
                                                setSelectedModels(prev => [...prev, model.id]);
                                            }
                                        }}
                                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${isSelected ? 'border-primary bg-primary/5' : 'border-border'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-semibold">{model.name}</h4>
                                                <p className="text-xs text-muted-foreground">{model.description}</p>
                                            </div>
                                            {isSelected && (
                                                <div className="bg-primary text-primary-foreground rounded-full p-1">
                                                    <Check className="h-4 w-4" />
                                                </div>
                                            )}
                                        </div>

                                        {isSelected && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="mt-2 w-full"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    fetchMissingAccounts(model.id);
                                                }}
                                            >
                                                Vorschau anzeigen
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Preview Missing Accounts */}
                        {previewModel && missingAccounts.length > 0 && (
                            <div className="border rounded-lg p-4 bg-muted/50">
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Neue Konten: {missingAccounts.length}
                                </h4>
                                <div className="max-h-60 overflow-y-auto space-y-2">
                                    {missingAccounts.map((acc, idx) => (
                                        <div key={idx} className="flex items-center gap-3 text-sm bg-background p-2 rounded">
                                            <Badge variant="outline" className="font-mono">{acc.code}</Badge>
                                            <span>{acc.name}</span>
                                            <span className="text-xs text-muted-foreground ml-auto">{acc.category}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Warning */}
                        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                            <p className="text-sm text-yellow-900 dark:text-yellow-100">
                                <strong>Hinweis:</strong> Bestehende Konten und Buchungen bleiben unverändert.
                                Es werden nur neue Konten hinzugefügt.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowExtendDialog(false);
                                    setSelectedModels([]);
                                    setPreviewModel(null);
                                    setMissingAccounts([]);
                                }}
                                className="flex-1"
                            >
                                Abbrechen
                            </Button>
                            <Button
                                onClick={handleExtend}
                                disabled={selectedModels.length === 0 || isExtending}
                                className="flex-1"
                            >
                                {isExtending ? 'Erweitere...' : `Kontenplan erweitern (${selectedModels.length})`}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
