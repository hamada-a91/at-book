import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, X, Calendar, FileText, Upload, Receipt, Euro, User } from 'lucide-react';
import { ContactSelector } from '@/components/ContactSelector';
import { BelegType } from '@/types/beleg';

interface Contact {
    id: number;
    name: string;
    type: 'customer' | 'vendor' | 'both' | 'other';
}

export function BelegCreate() {
    const navigate = useNavigate();
    const { tenant, id } = useParams<{ tenant: string; id: string }>();
    const queryClient = useQueryClient();
    const isEditMode = !!id;

    const [documentType, setDocumentType] = useState<BelegType>('eingang');
    const [title, setTitle] = useState('');
    const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState<number>(0);
    const [taxAmount, setTaxAmount] = useState<number>(0);
    const [taxRate, setTaxRate] = useState<number>(19);
    const [contactId, setContactId] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const { data: contacts } = useQuery<Contact[]>({
        queryKey: ['contacts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/contacts');
            return data;
        },
    });

    // Load existing beleg data if editing
    const { data: existingBeleg } = useQuery({
        queryKey: ['beleg', id],
        queryFn: async () => {
            if (!id) return null;
            const { data } = await axios.get(`/api/belege/${id}`);
            return data;
        },
        enabled: !!id,
    });

    // Populate form when beleg data loads
    useEffect(() => {
        if (existingBeleg) {
            setDocumentType(existingBeleg.document_type);
            setTitle(existingBeleg.title);
            setDocumentDate(existingBeleg.document_date?.split('T')[0] || '');

            const amountEur = existingBeleg.amount / 100;
            const taxAmountEur = existingBeleg.tax_amount / 100;

            setAmount(amountEur);
            setTaxAmount(taxAmountEur);

            // Calculate tax rate from existing data
            if (amountEur > 0 && taxAmountEur > 0) {
                const netAmount = amountEur - taxAmountEur;
                const calculatedRate = Math.round((taxAmountEur / netAmount) * 100);
                setTaxRate(calculatedRate);
            }

            setContactId(existingBeleg.contact_id?.toString() || '');
            setNotes(existingBeleg.notes || '');
            setDueDate(existingBeleg.due_date?.split('T')[0] || '');
        }
    }, [existingBeleg]);

    const createBelegMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = isEditMode ? `/api/belege/${id}` : '/api/belege';
            const method = isEditMode ? 'put' : 'post';

            try {
                // @ts-ignore
                const { data: responseData } = await axios[method](url, data);
                console.log('Beleg response:', responseData);
                return responseData;
            } catch (error: any) {
                const errorMsg = error.response?.data?.message || 'Fehler beim Speichern';
                throw new Error(errorMsg);
            }
        },
        onSuccess: async (data) => {
            console.log('Beleg created/updated successfully:', data);

            // Upload file if selected
            if (selectedFile && !isEditMode) {
                try {
                    await uploadFileMutation.mutateAsync({ belegId: data.id, file: selectedFile });
                } catch (error) {
                    console.error('File upload failed:', error);
                    // Continue even if file upload fails
                }
            }

            queryClient.invalidateQueries({ queryKey: ['belege'] });
            navigate(`/${tenant}/belege/${data.id}`);
        },
        onError: (error: Error) => {
            console.error('Beleg mutation error:', error);
            alert(`Fehler: ${error.message}`);
        },
    });

    const uploadFileMutation = useMutation({
        mutationFn: async ({ belegId, file }: { belegId: number; file: File }) => {
            const formData = new FormData();
            formData.append('file', file);

            const { data } = await axios.post(`/api/belege/${belegId}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return data;
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        createBelegMutation.mutate({
            document_type: documentType,
            title,
            document_date: documentDate,
            amount: Math.round((amount || 0) * 100),
            tax_amount: Math.round((taxAmount || 0) * 100),
            contact_id: contactId ? parseInt(contactId) : null,
            notes: notes || null,
            due_date: dueDate || null,
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleAmountChange = (value: number) => {
        const safeValue = isNaN(value) ? 0 : value;
        setAmount(safeValue);

        const netAmount = safeValue / (1 + taxRate / 100);
        const tax = safeValue - netAmount;
        setTaxAmount(parseFloat(tax.toFixed(2)));
    };

    const handleTaxRateChange = (rate: number) => {
        setTaxRate(rate);
        if (amount > 0) {
            const netAmount = amount / (1 + rate / 100);
            const tax = amount - netAmount;
            setTaxAmount(parseFloat(tax.toFixed(2)));
        }
    };

    const typeLabels: Record<BelegType, string> = {
        ausgang: 'Ausgangsbeleg',
        eingang: 'Eingangsbeleg',
        offen: 'Offener Beleg / Rechnung zu bezahlen',
        sonstige: 'Sonstiger Beleg',
    };

    const typeDescriptions: Record<BelegType, string> = {
        ausgang: 'Ausgehende Belege wie Lieferscheine, Kassenbelege',
        eingang: 'Eingehende Belege wie Lieferantenrechnungen, Quittungen',
        offen: 'Unbezahlte Lieferantenrechnungen und offene Posten',
        sonstige: 'Sonstige Geschäftsbelege und Dokumente',
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link to={`/${tenant}/belege`}>
                    <Button variant="ghost" size="icon" className="h-10 w-10">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        {isEditMode ? 'Beleg bearbeiten' : 'Neuer Beleg'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {isEditMode ? 'Bearbeite die Belegdaten' : 'Erstelle einen neuen Geschäftsbeleg'}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Document Type */}
                <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-primary" />
                            Belegart
                        </CardTitle>
                        <CardDescription>
                            Wählen Sie die Art des Belegs aus.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Belegart *
                            </label>
                            <Select value={documentType} onValueChange={(value) => setDocumentType(value as BelegType)}>
                                <SelectTrigger className="bg-white dark:bg-slate-950">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ausgang">Ausgangsbeleg</SelectItem>
                                    <SelectItem value="eingang">Eingangsbeleg</SelectItem>
                                    <SelectItem value="offen">Offener Beleg</SelectItem>
                                    <SelectItem value="sonstige">Sonstiger Beleg</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                {typeDescriptions[documentType]}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Document Details */}
                <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            Belegdetails
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Titel / Beschreibung *
                            </label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="z.B. Büromaterial Einkauf"
                                required
                                className="bg-white dark:bg-slate-950"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Belegdatum *
                                </label>
                                <Input
                                    type="date"
                                    value={documentDate}
                                    onChange={(e) => setDocumentDate(e.target.value)}
                                    required
                                    className="bg-white dark:bg-slate-950"
                                />
                            </div>
                            {(documentType === 'offen' || documentType === 'eingang') && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Fälligkeitsdatum
                                    </label>
                                    <Input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="bg-white dark:bg-slate-950"
                                    />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Contact Selection */}
                <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="w-5 h-5 text-primary" />
                            Kontakt
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Kontakt / Lieferant / Kunde
                            </label>
                            <ContactSelector
                                contacts={contacts}
                                value={contactId}
                                onChange={setContactId}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Amount Details */}
                <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Euro className="w-5 h-5 text-primary" />
                            Beträge
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Gesamtbetrag (Brutto) *
                                </label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={amount || ''}
                                    onChange={(e) => handleAmountChange(parseFloat(e.target.value))}
                                    placeholder="0.00"
                                    required
                                    className="bg-white dark:bg-slate-950"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Steuersatz
                                </label>
                                <Select value={taxRate.toString()} onValueChange={(value) => handleTaxRateChange(parseFloat(value))}>
                                    <SelectTrigger className="bg-white dark:bg-slate-950">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="19">19% USt.</SelectItem>
                                        <SelectItem value="7">7% USt.</SelectItem>
                                        <SelectItem value="0">0% (steuerfrei)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Steuerbetrag
                                </label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={taxAmount || ''}
                                    readOnly
                                    className="bg-slate-50 dark:bg-slate-900 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Nettobetrag:
                                </span>
                                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                    {(amount - taxAmount).toFixed(2)} €
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* File Upload */}
                <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="w-5 h-5 text-primary" />
                            Datei hochladen
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Beleg-Datei (PDF, JPG, PNG)
                            </label>
                            <Input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={handleFileChange}
                                className="bg-white dark:bg-slate-950"
                            />
                            {selectedFile && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                                    ✓ {selectedFile.name} ausgewählt
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Notes */}
                <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            Notizen
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Zusätzliche Notizen oder Bemerkungen..."
                            rows={4}
                            className="bg-white dark:bg-slate-950 resize-none"
                        />
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-end gap-4 pb-8">
                    <Button type="button" variant="outline" onClick={() => navigate(`/${tenant}/belege`)} className="gap-2">
                        <X className="w-4 h-4" />
                        Abbrechen
                    </Button>
                    <Button
                        type="submit"
                        disabled={createBelegMutation.isPending || uploadFileMutation.isPending}
                        variant="outline"
                        className="gap-2 border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                    >
                        <Save className="w-4 h-4" />
                        {createBelegMutation.isPending || uploadFileMutation.isPending
                            ? (isEditMode ? 'Speichere...' : 'Erstelle...')
                            : (isEditMode ? 'Änderungen speichern' : 'Beleg erstellen')
                        }
                    </Button>
                </div>
            </form>
        </div>
    );
}
