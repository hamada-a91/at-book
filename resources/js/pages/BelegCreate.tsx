import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import axios from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, X, Calendar, FileText, Upload, Receipt, Euro, User, Plus, Trash2, Package } from 'lucide-react';
import { ContactSelector } from '@/components/ContactSelector';
import { AccountSelector } from '@/components/AccountSelector';
import { ProductSelector } from '@/components/ProductSelector';
import { ProjectSelector } from '@/components/ProjectSelector';
import { CostCenterSelector } from '@/components/CostCenterSelector';
import { BelegType } from '@/types/beleg';

interface Product {
    id: number;
    name: string;
    type: string;
    article_number: string | null;
    price_net: number;
    price_gross: number;
    tax_rate: number;
    unit: string;
}

interface BelegLine {
    product_id: number | null;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    tax_rate: number;
    cost_center_id?: string;
}

interface Contact {
    id: number;
    name: string;
    type: 'customer' | 'vendor' | 'both' | 'other';
}

interface Account {
    id: number;
    code: string;
    name: string;
    type: string;
}

interface BankTransaction {
    id: number;
    booking_date: string;
    counterparty?: string | null;
    purpose?: string | null;
    amount: number;
    currency: string;
}

interface OcrField<T = any> {
    value: T | null;
    confidence: number;
    source?: string | null;
}

interface BelegOcrData {
    fields?: Record<string, OcrField>;
    confidence?: number;
    source?: string;
    error?: string;
}

interface BelegResponse {
    id: number;
    ocr_status?: 'none' | 'pending' | 'processing' | 'done' | 'failed';
    ocr_data?: BelegOcrData | null;
    [key: string]: any;
}

export function BelegCreate() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { tenant, id } = useParams<{ tenant: string; id: string }>();
    const locationState = location.state as { bankTransaction?: BankTransaction; returnTo?: string } | null;
    const sourceBankTransactionId = searchParams.get('bank_transaction_id');
    const returnTo = searchParams.get('return_to') || locationState?.returnTo || `/${tenant}/banking`;
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
    const [categoryAccountId, setCategoryAccountId] = useState<string>('');
    const [isPaid, setIsPaid] = useState(false);
    const [paymentAccountId, setPaymentAccountId] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [localPreviewUrl, setLocalPreviewUrl] = useState('');
    const [serverPreviewUrl, setServerPreviewUrl] = useState('');
    const [showProductLines, setShowProductLines] = useState(false);
    const [lines, setLines] = useState<BelegLine[]>([]);
    const [projectId, setProjectId] = useState<string | undefined>();
    const [costCenterId, setCostCenterId] = useState<string | undefined>();
    const [ocrDraftId, setOcrDraftId] = useState<string>('');
    const [ocrApplied, setOcrApplied] = useState(false);
    const activeBelegId = id || ocrDraftId;

    useEffect(() => {
        if (!selectedFile) {
            setLocalPreviewUrl('');
            return;
        }

        const objectUrl = URL.createObjectURL(selectedFile);
        setLocalPreviewUrl(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [selectedFile]);

    // SPEC-08 (Teil B): Projekt-Feld nur zeigen, wenn das Modul aktiv ist.
    const { data: companySettings } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => (await axios.get('/api/settings')).data,
    });

    const { data: contacts } = useQuery<Contact[]>({
        queryKey: ['contacts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/contacts');
            return data;
        },
    });

    // Fetch expense/revenue accounts for Sachkonto selection
    const { data: accounts } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/accounts');
            return data;
        },
    });

    const { data: fetchedBankTransaction } = useQuery<BankTransaction | null>({
        queryKey: ['bank-transaction', sourceBankTransactionId],
        queryFn: async () => {
            if (!sourceBankTransactionId) return null;
            const { data } = await axios.get(`/api/bank-transactions/${sourceBankTransactionId}`);
            return data;
        },
        enabled: !!sourceBankTransactionId && !locationState?.bankTransaction,
    });
    const sourceBankTransaction = locationState?.bankTransaction || fetchedBankTransaction || null;

    // Load existing beleg data if editing
    const { data: existingBeleg } = useQuery<BelegResponse | null>({
        queryKey: ['beleg', activeBelegId],
        queryFn: async () => {
            if (!activeBelegId) return null;
            const { data } = await axios.get(`/api/belege/${activeBelegId}`);
            return data;
        },
        enabled: !!activeBelegId,
        refetchInterval: (query) => {
            const status = (query.state.data as BelegResponse | null | undefined)?.ocr_status;
            return ocrDraftId && status !== 'done' && status !== 'failed' ? 1500 : false;
        },
    });

    useEffect(() => {
        if (!activeBelegId || selectedFile) {
            setServerPreviewUrl('');
            return;
        }

        let objectUrl = '';
        let cancelled = false;

        axios.get(`/api/belege/${activeBelegId}/download`, { responseType: 'blob' })
            .then(({ data }) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(data);
                setServerPreviewUrl(objectUrl);
            })
            .catch(() => setServerPreviewUrl(''));

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [activeBelegId, selectedFile, existingBeleg?.file_name]);

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
            setCategoryAccountId(existingBeleg.category_account_id?.toString() || '');
            setIsPaid(existingBeleg.is_paid || false);
            setPaymentAccountId(existingBeleg.payment_account_id?.toString() || '');
            setNotes(existingBeleg.notes || '');
            setDueDate(existingBeleg.due_date?.split('T')[0] || '');
        }
    }, [existingBeleg]);

    useEffect(() => {
        if (existingBeleg?.ocr_status !== 'done' || ocrApplied) return;

        const fields = existingBeleg.ocr_data?.fields || {};
        const value = <T,>(name: string): T | null => (fields[name]?.value as T | null | undefined) ?? null;
        const grossAmount = value<number>('gross_amount');
        const tax = value<number>('tax_amount');
        const detectedTaxRate = value<number>('tax_rate');
        const detectedContactId = value<number>('contact_id');
        const detectedAccountId = value<number>('category_account_id');
        const supplierName = value<string>('supplier_name');
        const invoiceNumber = value<string>('invoice_number');

        setDocumentType('eingang');
        setTitle([supplierName, invoiceNumber ? `Rechnung ${invoiceNumber}` : ''].filter(Boolean).join(' - ') || existingBeleg.title || 'OCR-Beleg');

        const detectedDate = value<string>('document_date');
        if (detectedDate) setDocumentDate(detectedDate);

        const detectedDueDate = value<string>('due_date');
        if (detectedDueDate) setDueDate(detectedDueDate);

        if (typeof grossAmount === 'number') setAmount(grossAmount / 100);
        if (typeof tax === 'number') setTaxAmount(tax / 100);
        if (typeof detectedTaxRate === 'number') setTaxRate(detectedTaxRate);
        if (detectedContactId) {
            setContactId(detectedContactId.toString());
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
        }
        if (detectedAccountId) setCategoryAccountId(detectedAccountId.toString());

        setNotes([
            existingBeleg.notes || '',
            invoiceNumber ? `OCR-Rechnungsnummer: ${invoiceNumber}` : '',
            supplierName && !detectedContactId ? `OCR-Lieferant (bitte Kontakt zuordnen): ${supplierName}` : '',
        ].filter(Boolean).join('\n'));
        setOcrApplied(true);
    }, [existingBeleg?.ocr_status, existingBeleg?.ocr_data, existingBeleg?.title, existingBeleg?.notes, ocrApplied, queryClient]);

    useEffect(() => {
        if (!sourceBankTransaction || isEditMode) return;
        const gross = Math.abs(sourceBankTransaction.amount) / 100;
        const tax = gross - (gross / (1 + taxRate / 100));
        setDocumentType(sourceBankTransaction.amount > 0 ? 'ausgang' : 'eingang');
        setTitle(sourceBankTransaction.counterparty || sourceBankTransaction.purpose || 'Bankumsatz');
        setDocumentDate(sourceBankTransaction.booking_date?.split('T')[0] || new Date().toISOString().split('T')[0]);
        setAmount(parseFloat(gross.toFixed(2)));
        setTaxAmount(parseFloat(tax.toFixed(2)));
        setIsPaid(false);
        setPaymentAccountId('');
        setNotes([
            'Aus Bankumsatz erstellt.',
            sourceBankTransaction.counterparty ? `Gegenpartei: ${sourceBankTransaction.counterparty}` : '',
            sourceBankTransaction.purpose ? `Verwendungszweck: ${sourceBankTransaction.purpose}` : '',
        ].filter(Boolean).join('\n'));
    }, [sourceBankTransaction?.id, isEditMode, taxRate]);

    const createBelegMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = activeBelegId ? `/api/belege/${activeBelegId}` : '/api/belege';
            const method = activeBelegId ? 'put' : 'post';

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
            if (selectedFile && !activeBelegId) {
                try {
                    await uploadFileMutation.mutateAsync({ belegId: data.id, file: selectedFile });
                } catch (error) {
                    console.error('File upload failed:', error);
                    // Continue even if file upload fails
                }
            }

            queryClient.invalidateQueries({ queryKey: ['belege'] });
            if (sourceBankTransactionId && !isEditMode) {
                try {
                    await axios.post(`/api/belege/${data.id}/book`);
                    await axios.post(`/api/bank-transactions/${sourceBankTransactionId}/assign`, {
                        target_type: 'beleg',
                        target_id: data.id,
                        note: 'Automatisch aus neuem Beleg zugeordnet.',
                    });
                    queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
                    navigate(returnTo);
                    return;
                } catch (error: any) {
                    alert(error.response?.data?.error || 'Beleg wurde erstellt, konnte aber nicht automatisch zugeordnet werden. Bitte prüfen und manuell zuordnen.');
                }
            }
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

    const ocrUploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);

            const { data } = await axios.post('/api/belege/ocr-upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return data;
        },
        onSuccess: (data) => {
            setOcrDraftId(data.id.toString());
            setOcrApplied(false);
            queryClient.invalidateQueries({ queryKey: ['belege'] });
        },
        onError: (error: any) => {
            alert(error.response?.data?.message || 'OCR-Upload fehlgeschlagen. Bitte manuell erfassen.');
        },
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Format lines for backend
        const formattedLines: any[] = lines.map((line) => ({
            product_id: line.product_id,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unit_price: Math.round(line.unit_price * 100),
            tax_rate: line.tax_rate,
            cost_center_id: line.cost_center_id ? parseInt(line.cost_center_id) : (costCenterId ? parseInt(costCenterId) : undefined),
        }));

        if (sourceBankTransactionId && costCenterId && formattedLines.length === 0) {
            formattedLines.push({
                product_id: null,
                description: title || 'Bankumsatz',
                quantity: 1,
                unit: 'Pauschal',
                unit_price: Math.max(0, Math.round(((amount || 0) - (taxAmount || 0)) * 100)),
                tax_rate: taxRate,
                account_id: categoryAccountId ? parseInt(categoryAccountId) : undefined,
                cost_center_id: parseInt(costCenterId),
            });
        }

        createBelegMutation.mutate({
            document_type: documentType,
            title,
            document_date: documentDate,
            amount: Math.round((amount || 0) * 100),
            tax_amount: Math.round((taxAmount || 0) * 100),
            contact_id: contactId ? parseInt(contactId) : null,
            project_id: projectId ? parseInt(projectId) : null,
            category_account_id: categoryAccountId ? parseInt(categoryAccountId) : null,
            is_paid: isPaid,
            payment_account_id: isPaid && paymentAccountId ? parseInt(paymentAccountId) : null,
            notes: notes || null,
            due_date: dueDate || null,
            lines: formattedLines.length > 0 ? formattedLines : undefined,
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setSelectedFile(e.dataTransfer.files[0]);
        }
    };

    const startOcrUpload = () => {
        if (!selectedFile) return;
        ocrUploadMutation.mutate(selectedFile);
    };

    const addLine = () => {
        setLines([...lines, {
            product_id: null,
            description: '',
            quantity: 1,
            unit: 'Stück',
            unit_price: 0,
            tax_rate: 19,
        }]);
    };

    const removeLine = (index: number) => {
        setLines(lines.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: keyof BelegLine, value: any) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLines(newLines);
    };

    const handleProductSelect = (index: number, product: Product | null) => {
        if (!product) return;

        const newLines = [...lines];
        newLines[index] = {
            ...newLines[index],
            product_id: product.id,
            description: product.name,
            unit: product.unit,
            unit_price: product.price_net / 100,
            tax_rate: product.tax_rate,
        };
        setLines(newLines);
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

    const ocrStatus = existingBeleg?.ocr_status;
    const ocrFields = existingBeleg?.ocr_data?.fields || {};
    const documentPreviewUrl = localPreviewUrl || serverPreviewUrl;
    const previewFileName = selectedFile?.name || existingBeleg?.file_name || '';
    const isDocumentPreviewPdf = (selectedFile?.type || '').includes('pdf') || previewFileName.toLowerCase().endsWith('.pdf');
    const isLowConfidence = (name: string) => {
        const field = ocrFields[name];
        return field?.value !== null && field?.value !== undefined && (field.confidence ?? 0) < 0.8;
    };
    const lowConfidenceLabels = Object.entries({
        document_date: 'Belegdatum',
        invoice_number: 'Rechnungsnummer',
        due_date: 'Faelligkeit',
        gross_amount: 'Bruttobetrag',
        tax_amount: 'Steuerbetrag',
        supplier_name: 'Lieferant',
        contact_id: 'Kontakt',
        category_account_id: 'Sachkonto',
    }).filter(([key]) => isLowConfidence(key)).map(([, label]) => label);

    return (
        <div className="max-w-7xl mx-auto space-y-6 p-0 md:p-4 pb-12">
                <div className="flex items-center gap-4">
                    <Link to={sourceBankTransactionId ? returnTo : `/${tenant}/belege`}>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {isEditMode ? 'Beleg bearbeiten' : 'Neuer Beleg'}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            {isEditMode ? 'Bearbeite die Belegdaten' : 'Erstelle einen neuen Geschäftsbeleg'}
                        </p>
                    </div>
                </div>

                {sourceBankTransaction && !isEditMode && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                        <div className="font-semibold">Aus Bankumsatz erstellt</div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                            <span>{new Date(sourceBankTransaction.booking_date).toLocaleDateString('de-DE')}</span>
                            <span>{sourceBankTransaction.counterparty || '-'}</span>
                            <span>{(sourceBankTransaction.amount / 100).toLocaleString('de-DE', { style: 'currency', currency: sourceBankTransaction.currency || 'EUR' })}</span>
                        </div>
                    </div>
                )}

                {ocrDraftId && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100">
                        <div className="font-semibold">
                            {ocrStatus === 'done' ? 'OCR abgeschlossen' : ocrStatus === 'failed' ? 'OCR fehlgeschlagen' : 'Beleg wird ausgelesen ...'}
                        </div>
                        {ocrStatus === 'done' && lowConfidenceLabels.length > 0 && (
                            <div className="mt-1 text-amber-800 dark:text-amber-200">Bitte pruefen: {lowConfidenceLabels.join(', ')}</div>
                        )}
                        {ocrStatus === 'failed' && (
                            <div className="mt-1">{existingBeleg?.ocr_data?.error || 'Bitte erfassen Sie den Beleg manuell.'}</div>
                        )}
                    </div>
                )}

                <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="w-5 h-5 text-primary" />
                            Datei hochladen
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            className="rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-700"
                        >
                            <Input
                                type="file"
                                accept="image/*,application/pdf"
                                capture="environment"
                                onChange={handleFileChange}
                                className="bg-white dark:bg-slate-950"
                            />
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                {selectedFile && (
                                    <span className="text-sm text-emerald-700 dark:text-emerald-300">
                                        {selectedFile.name} ausgewählt
                                    </span>
                                )}
                                {!isEditMode && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={startOcrUpload}
                                        disabled={!selectedFile || ocrUploadMutation.isPending || ocrStatus === 'pending' || ocrStatus === 'processing'}
                                        className="gap-2"
                                    >
                                        <Upload className="w-4 h-4" />
                                        {ocrUploadMutation.isPending || ocrStatus === 'pending' || ocrStatus === 'processing' ? 'OCR läuft ...' : 'Beleg scannen'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] xl:items-start">
                        <div className="xl:sticky xl:top-4">
                            <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-primary" />
                                        Vorschau
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {documentPreviewUrl ? (
                                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                                            {isDocumentPreviewPdf ? (
                                                <iframe
                                                    src={documentPreviewUrl}
                                                    title={previewFileName || 'Belegvorschau'}
                                                    className="h-[72vh] min-h-[520px] w-full"
                                                />
                                            ) : (
                                                <img
                                                    src={documentPreviewUrl}
                                                    alt={previewFileName || 'Belegvorschau'}
                                                    className="max-h-[72vh] min-h-[360px] w-full object-contain"
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                            Noch keine Datei ausgewählt
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                        <div className="space-y-6">
                    {/* Document Type */}
                    <Card className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                        <CardHeader className="border-b border-gray-200 dark:border-gray-700">
                            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                                <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                Belegart
                            </CardTitle>
                            <CardDescription className="text-gray-600 dark:text-gray-400">
                                Wählen Sie die Art des Belegs aus.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                                    Belegart *
                                </label>
                                <Select value={documentType} onValueChange={(value) => setDocumentType(value as BelegType)}>
                                    <SelectTrigger className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ausgang">Ausgangsbeleg</SelectItem>
                                        <SelectItem value="eingang">Eingangsbeleg</SelectItem>
                                        <SelectItem value="offen">Offener Beleg</SelectItem>
                                        <SelectItem value="sonstige">Sonstiger Beleg</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
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
                            {companySettings?.module_projects_enabled && (
                                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Projekt (optional)
                                        </label>
                                        <ProjectSelector value={projectId} onChange={setProjectId} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Kostenstelle (optional)
                                        </label>
                                        <CostCenterSelector value={costCenterId} onChange={setCostCenterId} />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Sachkonto (Category) Selection */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-primary" />
                                Sachkonto (Kategorie)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Sachkonto (Gegenkonto) *
                                </label>
                                <AccountSelector
                                    accounts={accounts}
                                    value={categoryAccountId}
                                    onChange={setCategoryAccountId}
                                    filterType={documentType === 'ausgang' ? ['revenue', 'equity'] : ['expense', 'equity']}
                                    placeholder="Sachkonto suchen..."
                                />
                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                    {documentType === 'ausgang'
                                        ? 'Z.B. Umsatzerlöse 19%, Sonstige Erlöse – oder Eigenkapital (z.B. Privateinlage/Kapitalrücklage)'
                                        : 'Z.B. Büromaterial, Reisekosten, Telefon – oder Eigenkapital (z.B. Privatentnahme)'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Product Lines (Optional - for inventory tracking) */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="w-5 h-5 text-primary" />
                                    Produktpositionen (Optional)
                                </CardTitle>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowProductLines(!showProductLines)}
                                    className="gap-1"
                                >
                                    {showProductLines ? 'Ausblenden' : 'Produkte hinzufügen'}
                                </Button>
                            </div>
                            <CardDescription>
                                {documentType === 'eingang'
                                    ? 'Fügen Sie Produkte hinzu, um den Lagerbestand beim Buchen automatisch zu erhöhen.'
                                    : 'Fügen Sie Produkte hinzu, um den Lagerbestand beim Buchen automatisch zu reduzieren.'}
                            </CardDescription>
                        </CardHeader>
                        {showProductLines && (
                            <CardContent className="space-y-4">
                                {lines.map((line, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <div className="col-span-12 md:col-span-4">
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                Produkt
                                            </label>
                                            <ProductSelector
                                                value={line.product_id}
                                                onChange={(product) => handleProductSelect(index, product)}
                                            />
                                        </div>
                                        <div className="col-span-6 md:col-span-2">
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                Menge
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={line.quantity}
                                                onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                className="bg-white dark:bg-slate-950"
                                            />
                                        </div>
                                        <div className="col-span-6 md:col-span-2">
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                Einheit
                                            </label>
                                            <Input
                                                value={line.unit}
                                                onChange={(e) => updateLine(index, 'unit', e.target.value)}
                                                className="bg-white dark:bg-slate-950"
                                            />
                                        </div>
                                        <div className="col-span-6 md:col-span-2">
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                Preis (netto)
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={line.unit_price}
                                                onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                className="bg-white dark:bg-slate-950"
                                            />
                                        </div>
                                        <div className="col-span-4 md:col-span-1 flex items-end">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeLine(index)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={addLine}
                                    className="w-full gap-2 border-dashed"
                                >
                                    <Plus className="w-4 h-4" />
                                    Position hinzufügen
                                </Button>
                            </CardContent>
                        )}
                    </Card>

                    {/* Direct Payment Option */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Euro className="w-5 h-5 text-primary" />
                                Direkte Zahlung
                            </CardTitle>
                            <CardDescription>
                                Optional: Bei Buchung wird gleichzeitig die Zahlung erfasst
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-3">
                                <input
                                    type="checkbox"
                                    id="isPaid"
                                    checked={isPaid}
                                    onChange={(e) => {
                                        setIsPaid(e.target.checked);
                                        if (!e.target.checked) {
                                            setPaymentAccountId('');
                                        }
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <label htmlFor="isPaid" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Bereits bezahlt (Barzahlung / sofort überwiesen)
                                </label>
                            </div>

                            {isPaid && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Zahlungskonto *
                                    </label>
                                    <AccountSelector
                                        accounts={accounts?.filter((account: any) => account.type === 'asset' && /^(10|12)\d{2}$/.test(String(account.code)))}
                                        value={paymentAccountId}
                                        onChange={setPaymentAccountId}
                                        filterType={['asset']}
                                        placeholder="Bank / Kasse wählen..."
                                    />
                                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                        Z.B. Bank, Kasse, PayPal
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
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

                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-4 pb-8">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigate(sourceBankTransactionId ? returnTo : `/${tenant}/belege`)}
                            className="gap-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        >
                            <X className="w-4 h-4" />
                            Abbrechen
                        </Button>
                        <Button
                            type="submit"
                            disabled={createBelegMutation.isPending || uploadFileMutation.isPending || ocrStatus === 'pending' || ocrStatus === 'processing'}
                            className="gap-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-lg shadow-indigo-500/30"
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
