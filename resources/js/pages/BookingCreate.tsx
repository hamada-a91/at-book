import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Plus, Trash2, Zap, Upload, FileText, Search, XCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ContactSelector } from '@/components/ContactSelector';
import { AccountSelector } from '@/components/AccountSelector';
import { roundToTwoDecimals, formatCurrency as formatEuro, calculateVAT } from '@/lib/currency';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface Account {
    id: number;
    code: string;
    name: string;
    type: string;
}

interface Contact {
    id: number;
    name: string;
    type: 'customer' | 'vendor' | 'both' | 'other';
    account_id?: number;
    customer_account_id?: number;
    vendor_account_id?: number;
}

const bookingSchema = z.object({
    date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Ungültiges Datum'),
    description: z.string().min(3, 'Beschreibung ist erforderlich'),
    contact_id: z.string().optional(),
    lines: z
        .array(
            z.object({
                account_id: z.string().min(1, 'Konto ist erforderlich'),
                type: z.enum(['debit', 'credit']),
                amount: z.coerce.number().min(0.01, 'Betrag muss positiv sein'),
            })
        )
        .min(2, 'Mindestens 2 Zeilen erforderlich')
        .refine(
            (lines) => {
                const debit = lines.filter((l) => l.type === 'debit').reduce((sum, l) => sum + l.amount, 0);
                const credit = lines.filter((l) => l.type === 'credit').reduce((sum, l) => sum + l.amount, 0);
                return Math.abs(debit - credit) < 0.01;
            },
            { message: 'Buchung muss ausgeglichen sein (Soll = Haben)' }
        ),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export function BookingCreate() {
    const navigate = useNavigate();
    const { tenant } = useParams();
    const queryClient = useQueryClient();
    // Beleg Workflow State
    type BelegOption = 'none' | 'attach' | 'create' | 'select' | 'exception';
    const [belegStep, setBelegStep] = useState<'select' | 'complete'>('select');
    const [selectedBelegOption, setSelectedBelegOption] = useState<BelegOption>('none');
    const [newBelegId, setNewBelegId] = useState<number | null>(null);
    const [showBelegDialog, setShowBelegDialog] = useState(false);

    // Inline Beleg Creation Form State
    const [newBelegData, setNewBelegData] = useState({
        document_type: 'eingang',
        title: '',
        document_date: new Date().toISOString().split('T')[0],
        due_date: '',
        notes: '',
        file: null as File | null,
    });

    // Quick Entry State with Direct Payment Option
    const [quickEntry, setQuickEntry] = useState({
        contact_id: '',
        contra_account_id: '',
        vat_rate: '19',
        gross_amount: '',
        is_paid: false,
        payment_account_id: '',
    });

    const { data: accounts } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/accounts');
            return data;
        },
    });

    const { data: contacts } = useQuery<Contact[]>({
        queryKey: ['contacts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/contacts');
            return data;
        },
    });

    const { data: belege } = useQuery({
        queryKey: ['belege'],
        queryFn: async () => {
            const { data } = await axios.get('/api/belege');
            return data;
        },
    });

    const [selectedBelegId, setSelectedBelegId] = useState<string>('');

    const form = useForm<BookingFormValues>({
        resolver: zodResolver(bookingSchema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            description: '',
            contact_id: 'none',
            lines: [
                { account_id: '', type: 'debit', amount: 0 },
                { account_id: '', type: 'credit', amount: 0 },
            ],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'lines',
    });

    const createMutation = useMutation({
        mutationFn: async (data: BookingFormValues) => {
            let belegIdToUse = selectedBelegId && selectedBelegId !== 'none' ? parseInt(selectedBelegId) : null;

            // If creating new Beleg inline, create it first
            if (selectedBelegOption === 'attach') {
                // Validate that we have booking lines
                if (!data.lines || data.lines.length === 0) {
                    throw new Error('Bitte fügen Sie mindestens eine Buchungszeile hinzu bevor Sie einen Beleg erstellen.');
                }

                // Calculate Beleg data from booking
                const debitSum = data.lines.filter(l => l.type === 'debit').reduce((sum, l) => sum + (parseFloat(String(l.amount)) || 0), 0);
                const creditSum = data.lines.filter(l => l.type === 'credit').reduce((sum, l) => sum + (parseFloat(String(l.amount)) || 0), 0);
                const totalAmount = Math.max(debitSum, creditSum); // Bruttobetrag

                if (totalAmount === 0) {
                    throw new Error('Der Buchungsbetrag muss größer als 0 sein um einen Beleg zu erstellen.');
                }

                // Try to find VAT amount from lines (if any account has 'USt' or 'Vst' in name)
                let taxAmount = 0;
                for (const line of data.lines) {
                    const account = accounts?.find(a => String(a.id) === line.account_id);
                    if (account && (account.code.includes('17') || account.code.includes('15'))) {
                        // VAT account detected
                        taxAmount = parseFloat(String(line.amount)) || 0;
                        break;
                    }
                }

                // Create FormData for file upload
                const formData = new FormData();
                formData.append('document_type', newBelegData.document_type);
                formData.append('title', newBelegData.title);
                formData.append('document_date', newBelegData.document_date);
                formData.append('amount', String(Math.round(totalAmount * 100))); // Convert to cents
                formData.append('tax_amount', String(Math.round(taxAmount * 100))); // Convert to cents
                if (data.contact_id && data.contact_id !== 'none') formData.append('contact_id', data.contact_id);
                if (newBelegData.notes) formData.append('notes', newBelegData.notes);
                if (newBelegData.due_date) formData.append('due_date', newBelegData.due_date);
                if (newBelegData.file) formData.append('file', newBelegData.file);

                // Debug: Log what we're sending
                console.log('Creating Beleg with data:', {
                    document_type: newBelegData.document_type,
                    title: newBelegData.title,
                    document_date: newBelegData.document_date,
                    amount: Math.round(totalAmount * 100),
                    tax_amount: Math.round(taxAmount * 100),
                    contact_id: data.contact_id,
                    has_file: !!newBelegData.file,
                });

                // Create Beleg
                try {
                    const { data: createdBeleg } = await axios.post('/api/belege', formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                        },
                    });

                    belegIdToUse = createdBeleg.id;
                    setNewBelegId(createdBeleg.id);
                } catch (error: any) {
                    let errorMessage = 'Fehler beim Erstellen des Belegs';
                    if (error.response?.data?.message) {
                        errorMessage = error.response.data.message;
                    } else if (error.response?.data?.error) {
                        errorMessage = error.response.data.error;
                    }
                    throw new Error(errorMessage);
                }
            }

            // Create Booking
            const payload = {
                date: data.date,
                description: data.description,
                contact_id: data.contact_id === 'none' || !data.contact_id ? null : data.contact_id,
                beleg_id: belegIdToUse,
                lines: data.lines.map((line) => ({
                    account_id: parseInt(line.account_id),
                    type: line.type,
                    amount: Math.round(line.amount * 100), // Convert to cents
                    tax_key: null,
                    tax_amount: 0,
                })),
            };

            try {
                const { data: resData } = await axios.post('/api/bookings', payload);
                return resData;
            } catch (error: any) {
                throw new Error(error.response?.data?.error || error.response?.data?.message || 'Fehler beim Erstellen der Buchung');
            }
        },
        onSuccess: () => {
            navigate(`/${tenant}/bookings`);
        },
        onError: (error: Error) => {
            alert('Fehler: ' + error.message);
        },
    });

    const onSubmit = (data: BookingFormValues) => {
        // Validate that Beleg step is completed
        if (belegStep !== 'complete') {
            alert('Bitte wählen Sie zuerst eine Beleg-Option aus.');
            return;
        }
        createMutation.mutate(data);
    };

    const debitSum = form.watch('lines').filter((l) => l.type === 'debit').reduce((sum, l) => sum + (parseFloat(String(l.amount)) || 0), 0);
    const creditSum = form.watch('lines').filter((l) => l.type === 'credit').reduce((sum, l) => sum + (parseFloat(String(l.amount)) || 0), 0);
    const isBalanced = Math.abs(debitSum - creditSum) < 0.01 && debitSum > 0;

    // Quick Entry Handler with All Improvements
    const handleQuickEntry = () => {
        const { contact_id, contra_account_id, vat_rate, gross_amount, is_paid, payment_account_id } = quickEntry;

        // Validation
        if (!contact_id || !contra_account_id || !gross_amount) {
            alert('Bitte füllen Sie alle Pflichtfelder aus.');
            return;
        }

        if (is_paid && !payment_account_id) {
            alert('Bitte wählen Sie ein Zahlungskonto (Kasse/Bank).');
            return;
        }

        const selectedContact = contacts?.find(c => String(c.id) === contact_id);
        if (!selectedContact) {
            alert('Kontakt nicht gefunden.');
            return;
        }

        // Check if ANY account is assigned (support for dual accounts)
        if (!selectedContact.account_id && !selectedContact.customer_account_id && !selectedContact.vendor_account_id && selectedContact.type !== 'other') {
            alert('Kontakt hat kein zugeordnetes Konto.');
            return;
        }

        const grossNum = parseFloat(gross_amount);
        if (isNaN(grossNum) || grossNum <= 0) {
            alert('Ungültiger Bruttobetrag.');
            return;
        }

        // Calculate VAT with proper rounding
        const { gross, net, tax } = calculateVAT(grossNum, parseFloat(vat_rate));

        // Find VAT account by CODE (more reliable than hardcoded IDs)
        let vatAccount: Account | undefined;
        if (parseFloat(vat_rate) > 0) {
            const vatCode = selectedContact.type === 'customer'
                ? (vat_rate === '19' ? '1776' : '1771') // Umsatzsteuer
                : (vat_rate === '19' ? '1576' : '1571'); // Vorsteuer
            vatAccount = accounts?.find(acc => acc.code === vatCode);
        }

        // Generate booking lines
        const newLines = [];

        // ========================================
        // WICHTIG: Bei "Direkt bezahlt" = 5 ZEILEN!
        // ========================================
        // Determine Transaction Type (Customer Sale vs Vendor Purchase)
        const contraAccount = accounts?.find(a => String(a.id) === contra_account_id);
        let transactionType: 'customer' | 'vendor' | 'other' = 'vendor'; // Default

        if (selectedContact.type === 'customer') {
            transactionType = 'customer';
        } else if (selectedContact.type === 'vendor') {
            transactionType = 'vendor';
        } else if (selectedContact.type === 'both') {
            // If 'both', decide based on Contra Account Type
            // Revenue -> Customer Sale
            // Expense -> Vendor Purchase
            if (contraAccount?.type === 'revenue') {
                transactionType = 'customer';
            } else {
                transactionType = 'vendor';
            }
        } else if (selectedContact.type === 'other') {
            transactionType = 'other';
        }

        // Helper to get correct account ID
        const getAccountId = (contact: Contact, type: 'customer' | 'vendor' | 'other') => {
            if (type === 'customer') {
                return contact.customer_account_id ? String(contact.customer_account_id) : String(contact.account_id); // Fallback
            } else if (type === 'vendor') {
                return contact.vendor_account_id ? String(contact.vendor_account_id) : String(contact.account_id); // Fallback
            } else {
                // For 'other', we use the manually assigned account_id
                return contact.account_id ? String(contact.account_id) : '';
            }
        };

        const accountId = getAccountId(selectedContact, transactionType);

        if (!accountId && transactionType !== 'other') {
            alert('Kontakt hat kein passendes Konto (Debitor/Kreditor) zugeordnet.');
            return;
        }

        // If 'other' type, we skip auto-generation of the contact line or ask user to select account.
        // The requirement says: "User macht: 1. Kontakt -> Ahmed (Sonstiges). 2. System erzeugt NICHTS automatisch. 3. User klickt: 'Konto hinzufügen'".
        // So for 'other', we just populate the contra account line? Or maybe nothing?
        // "System erzeugt NICHTS automatisch" implies we shouldn't generate lines for the contact part.
        // But we can generate the contra account part?
        // Let's generate what we can.

        if (transactionType === 'other') {
            // For 'other' type, we use the account assigned to the contact.
            // If accountId is present (which it should be if contact has account_id), we generate the line.

            // Primary Account Line (e.g. Loan Account)
            if (accountId) {
                newLines.push({
                    account_id: accountId,
                    type: (contraAccount?.type === 'revenue' ? 'debit' : 'credit') as 'debit' | 'credit', // Opposite of contra? Or depends?
                    // Usually:
                    // If Contra is Revenue (Credit), then Primary is Debit.
                    // If Contra is Expense (Debit), then Primary is Credit.
                    // But for "Neutral", it depends.
                    // Let's assume standard double entry logic:
                    // If we selected a Revenue account as Contra, we are receiving money/claim -> Debit the Contact Account.
                    amount: gross,
                });
            }

            // Contra Account Line

            // Contra Account Line
            newLines.push({
                account_id: contra_account_id,
                type: (contraAccount?.type === 'revenue' ? 'credit' : 'debit') as 'debit' | 'credit',
                amount: net,
            });

            // VAT Line
            if (vatAccount && tax > 0) {
                newLines.push({
                    account_id: String(vatAccount.id),
                    type: (contraAccount?.type === 'revenue' ? 'credit' : 'debit') as 'debit' | 'credit',
                    amount: tax,
                });
            }

            // We don't add the contact line. The user has to add it.
            // But we should probably add the payment line if "is_paid" is true?
            if (is_paid && payment_account_id) {
                newLines.push({
                    account_id: payment_account_id,
                    type: (contraAccount?.type === 'revenue' ? 'debit' : 'credit') as 'debit' | 'credit',
                    amount: gross,
                });
            }

        } else {

            // ========================================
            // WICHTIG: Bei "Direkt bezahlt" = 5 ZEILEN!
            // ========================================
            if (is_paid) {
                // *** PAID: 5 LINES (Invoice 3 + Payment 2) ***

                if (transactionType === 'customer') {
                    // === SCHRITT 1: RECHNUNG (3 Zeilen) ===

                    // Zeile 1: Soll Debitor 119€
                    newLines.push({
                        account_id: accountId,
                        type: 'debit' as const,
                        amount: gross,
                    });

                    // Zeile 2: Haben Erlöse 100€
                    newLines.push({
                        account_id: contra_account_id,
                        type: 'credit' as const,
                        amount: net,
                    });

                    // Zeile 3: Haben USt 19€
                    if (vatAccount && tax > 0) {
                        newLines.push({
                            account_id: String(vatAccount.id),
                            type: 'credit' as const,
                            amount: tax,
                        });
                    }

                    // === SCHRITT 2: ZAHLUNG (2 Zeilen) ===

                    // Zeile 4: Soll Kasse 119€
                    newLines.push({
                        account_id: payment_account_id,
                        type: 'debit' as const,
                        amount: gross,
                    });

                    // Zeile 5: Haben Debitor 119€
                    newLines.push({
                        account_id: accountId,
                        type: 'credit' as const,
                        amount: gross,
                    });

                } else {
                    // === VENDOR: SCHRITT 1: RECHNUNG (3 Zeilen) ===

                    // Zeile 1: Haben Kreditor
                    newLines.push({
                        account_id: accountId,
                        type: 'credit' as const,
                        amount: gross,
                    });

                    // Zeile 2: Soll Aufwand
                    newLines.push({
                        account_id: contra_account_id,
                        type: 'debit' as const,
                        amount: net,
                    });

                    // Zeile 3: Soll Vorsteuer
                    if (vatAccount && tax > 0) {
                        newLines.push({
                            account_id: String(vatAccount.id),
                            type: 'debit' as const,
                            amount: tax,
                        });
                    }

                    // === SCHRITT 2: ZAHLUNG (2 Zeilen) ===

                    // Zeile 4: Haben Kasse/Bank
                    newLines.push({
                        account_id: payment_account_id,
                        type: 'credit' as const,
                        amount: gross,
                    });

                    // Zeile 5: Soll Kreditor
                    newLines.push({
                        account_id: accountId,
                        type: 'debit' as const,
                        amount: gross,
                    });
                }
            } else {
                // UNPAID VERSION: Contact account instead of cash/bank
                if (transactionType === 'customer') {
                    // Customer Sale: Debit Customer, Credit Revenue, Credit VAT
                    newLines.push({
                        account_id: accountId,
                        type: 'debit' as const,
                        amount: gross,
                    });
                    newLines.push({
                        account_id: contra_account_id,
                        type: 'credit' as const,
                        amount: net,
                    });
                    if (vatAccount && tax > 0) {
                        newLines.push({
                            account_id: String(vatAccount.id),
                            type: 'credit' as const,
                            amount: tax,
                        });
                    }
                } else {
                    // Vendor Purchase: Credit Vendor, Debit Expense, Debit Input VAT
                    newLines.push({
                        account_id: accountId,
                        type: 'credit' as const,
                        amount: gross,
                    });
                    newLines.push({
                        account_id: contra_account_id,
                        type: 'debit' as const,
                        amount: net,
                    });
                    if (vatAccount && tax > 0) {
                        newLines.push({
                            account_id: String(vatAccount.id),
                            type: 'debit' as const,
                            amount: tax,
                        });
                    }
                }
            }
        }

        // Update form
        form.setValue('lines', newLines);
        form.setValue('contact_id', contact_id);

        // Auto-generate description if empty
        if (!form.getValues('description')) {
            const accountName = accounts?.find(a => String(a.id) === contra_account_id)?.name || '';
            const paymentText = is_paid ? 'Bezahlt - ' : '';
            form.setValue('description', `${paymentText}${selectedContact.type === 'customer' ? 'Verkauf' : 'Einkauf'} - ${selectedContact.name} - ${accountName}`);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-3 md:p-6 pb-24 md:pb-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Neue Buchung</h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Buchungssatz erstellen</p>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => navigate(`/${tenant}/bookings`)}
                        className="gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white self-start sm:self-auto"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Zurück
                    </Button>
                </div>

                {/* Beleg Selection Workflow - REQUIRED STEP */}
                {belegStep === 'select' && (
                    <Card className="border-2 border-indigo-500 dark:border-indigo-600 shadow-xl bg-white dark:bg-gray-800">
                        <CardHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-gradient-to-br from-indigo-600 to-cyan-600 rounded-xl shadow-lg">
                                    <FileText className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl text-gray-900 dark:text-white">
                                        Schritt 1: Beleg zuordnen
                                    </CardTitle>
                                    <CardDescription className="text-gray-600 dark:text-gray-400 font-medium">
                                        Bitte wählen Sie eine der folgenden Optionen, um fortzufahren
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Option 1: Attach File & Create Beleg */}
                                <button
                                    onClick={() => {
                                        setSelectedBelegOption('attach');
                                        setBelegStep('select'); // Keep in select mode to show form
                                    }}
                                    className={`group relative p-6 rounded-xl border-2 transition-all duration-200 text-left ${selectedBelegOption === 'attach'
                                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 shadow-md'
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-400 hover:shadow-sm'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-lg ${selectedBelegOption === 'attach' ? 'bg-gradient-to-br from-indigo-600 to-cyan-600' : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30'}`}>
                                            <Upload className={`w-6 h-6 ${selectedBelegOption === 'attach' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                                                Neuen Beleg erstellen
                                            </h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Beleg-Daten eingeben und parallel mit Buchung erstellen
                                            </p>
                                        </div>
                                        {selectedBelegOption === 'attach' && (
                                            <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        )}
                                    </div>
                                </button>

                                {/* Option 2: Create New Beleg */}
                                <button
                                    onClick={() => {
                                        setSelectedBelegOption('create');
                                        // Navigate to Beleg creation page
                                        window.open(`/${tenant}/belege/create?from=booking`, '_blank');
                                        setShowBelegDialog(true);
                                    }}
                                    className={`group relative p-6 rounded-xl border-2 transition-all duration-200 text-left ${selectedBelegOption === 'create'
                                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 shadow-md'
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-400 hover:shadow-sm'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-lg ${selectedBelegOption === 'create' ? 'bg-gradient-to-br from-indigo-600 to-cyan-600' : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/30'}`}>
                                            <Plus className={`w-6 h-6 ${selectedBelegOption === 'create' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                                                Neuen Beleg erstellen
                                            </h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Beleg-Details in neuem Fenster erfassen
                                            </p>
                                        </div>
                                        {selectedBelegOption === 'create' && (
                                            <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        )}
                                    </div>
                                </button>

                                {/* Option 3: Select Existing Beleg */}
                                <button
                                    onClick={() => {
                                        setSelectedBelegOption('select');
                                        setShowBelegDialog(true);
                                    }}
                                    className={`group relative p-6 rounded-xl border-2 transition-all duration-200 text-left ${selectedBelegOption === 'select'
                                        ? 'border-blue-600 bg-blue-100 dark:bg-blue-950/50 shadow-md'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400 hover:shadow-sm'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-lg ${selectedBelegOption === 'select' ? 'bg-blue-600' : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30'}`}>
                                            <Search className={`w-6 h-6 ${selectedBelegOption === 'select' ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                                                Bestehenden Beleg auswählen
                                            </h3>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Aus vorhandenen Belegen wählen
                                            </p>
                                        </div>
                                        {selectedBelegOption === 'select' && (
                                            <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        )}
                                    </div>
                                </button>

                                {/* Option 4: Exception - Without Beleg */}
                                <button
                                    onClick={() => {
                                        setSelectedBelegOption('exception');
                                        setBelegStep('complete');
                                    }}
                                    className={`group relative p-6 rounded-xl border-2 transition-all duration-200 text-left ${selectedBelegOption === 'exception'
                                        ? 'border-amber-600 bg-amber-100 dark:bg-amber-950/50 shadow-md'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-amber-400 hover:shadow-sm'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`p-3 rounded-lg ${selectedBelegOption === 'exception' ? 'bg-amber-600' : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30'}`}>
                                            <XCircle className={`w-6 h-6 ${selectedBelegOption === 'exception' ? 'text-white' : 'text-slate-600 dark:text-slate-400'}`} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                                                Ohne Beleg (Ausnahme)
                                            </h3>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Nur in begründeten Ausnahmefällen
                                            </p>
                                        </div>
                                        {selectedBelegOption === 'exception' && (
                                            <Check className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                        )}
                                    </div>
                                </button>
                            </div>

                            {selectedBelegOption !== 'none' && selectedBelegOption !== 'exception' && selectedBelegOption !== 'attach' && (
                                <div className="mt-6 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-300 dark:border-blue-700">
                                    <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                                        ℹ️ Nach Abschluss der Beleg-Erfassung kehren Sie zu dieser Seite zurück und fahren fort.
                                    </p>
                                </div>
                            )}

                            {/* Inline Beleg Creation Form */}
                            {selectedBelegOption === 'attach' && (
                                <div className="mt-6 p-6 bg-white dark:bg-slate-900 rounded-xl border-2 border-blue-500 dark:border-blue-600 shadow-lg">
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        Neuen Beleg erstellen
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Document Type */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                                Belegart *
                                            </label>
                                            <Select
                                                value={newBelegData.document_type}
                                                onValueChange={(value) => setNewBelegData(prev => ({ ...prev, document_type: value }))}
                                            >
                                                <SelectTrigger className="bg-white dark:bg-slate-950">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="eingang">Eingangsrechnung</SelectItem>
                                                    <SelectItem value="ausgang">Ausgangsrechnung</SelectItem>
                                                    <SelectItem value="offen">Offener Posten</SelectItem>
                                                    <SelectItem value="sonstige">Sonstige</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Title */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                                Titel *
                                            </label>
                                            <Input
                                                value={newBelegData.title}
                                                onChange={(e) => setNewBelegData(prev => ({ ...prev, title: e.target.value }))}
                                                placeholder="z.B. Rechnung #12345"
                                                className="bg-white dark:bg-slate-950"
                                            />
                                        </div>

                                        {/* Document Date */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                                Belegdatum *
                                            </label>
                                            <Input
                                                type="date"
                                                value={newBelegData.document_date}
                                                onChange={(e) => setNewBelegData(prev => ({ ...prev, document_date: e.target.value }))}
                                                className="bg-white dark:bg-slate-950"
                                            />
                                        </div>

                                        {/* Due Date */}
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                                Fälligkeitsdatum (optional)
                                            </label>
                                            <Input
                                                type="date"
                                                value={newBelegData.due_date}
                                                onChange={(e) => setNewBelegData(prev => ({ ...prev, due_date: e.target.value }))}
                                                className="bg-white dark:bg-slate-950"
                                            />
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                💡 Betrag, MwSt und Kontakt werden automatisch aus der Buchung übernommen
                                            </p>
                                        </div>

                                        {/* File Upload */}
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                                Datei anhängen
                                            </label>
                                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 text-center bg-slate-50 dark:bg-slate-900">
                                                <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                                                <Input
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    onChange={(e) => setNewBelegData(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                                                    className="mt-2"
                                                />
                                                {newBelegData.file && (
                                                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">
                                                        ✓ {newBelegData.file.name}
                                                    </p>
                                                )}
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                                    PDF, JPG oder PNG (max. 10MB)
                                                </p>
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                                Notizen
                                            </label>
                                            <Input
                                                value={newBelegData.notes}
                                                onChange={(e) => setNewBelegData(prev => ({ ...prev, notes: e.target.value }))}
                                                placeholder="Optionale Notizen..."
                                                className="bg-white dark:bg-slate-950"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-6 flex gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setSelectedBelegOption('none');
                                                setNewBelegData({
                                                    document_type: 'eingang',
                                                    title: '',
                                                    document_date: new Date().toISOString().split('T')[0],
                                                    due_date: '',
                                                    notes: '',
                                                    file: null,
                                                });
                                            }}
                                            className="flex-1"
                                        >
                                            Abbrechen
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                // Validate required fields
                                                if (!newBelegData.title || !newBelegData.document_date) {
                                                    alert('Bitte füllen Sie alle Pflichtfelder aus (Titel, Datum)');
                                                    return;
                                                }
                                                setBelegStep('complete');
                                            }}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            <Check className="w-4 h-4 mr-2" />
                                            Beleg-Daten bestätigen
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Beleg Confirmation - Once selected */}
                {belegStep === 'complete' && (
                    <Card className="border-2 border-emerald-500 dark:border-emerald-600 shadow-md bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30">
                        <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-emerald-600 rounded-lg">
                                        <Check className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
                                            {selectedBelegOption === 'exception' && 'Ohne Beleg (Ausnahme)'}
                                            {selectedBelegOption === 'select' && `Beleg #${selectedBelegId}`}
                                            {selectedBelegOption === 'create' && 'Neuer Beleg (Externes Fenster)'}
                                            {selectedBelegOption === 'attach' && (
                                                <span>
                                                    Neuer Beleg: {newBelegData.title || '(Noch nicht ausgefüllt)'}
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                            {selectedBelegOption === 'attach'
                                                ? 'Beleg wird beim Speichern automatisch erstellt'
                                                : 'Sie können nun mit der Buchung fortfahren'}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setBelegStep('select');
                                        setSelectedBelegOption('none');
                                        setSelectedBelegId('');
                                    }}
                                    className="border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                                >
                                    Ändern
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-6 lg:grid-cols-12">
                    {/* Main Form Area */}
                    <div className="lg:col-span-12 space-y-6">
                        {/* Quick Entry Card */}
                        <div className={`relative ${belegStep !== 'complete' ? 'opacity-50 pointer-events-none' : ''}`}>
                            {belegStep !== 'complete' && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/5 dark:bg-slate-100/5 rounded-lg">
                                    <div className="bg-white dark:bg-slate-800 px-6 py-3 rounded-lg shadow-lg border-2 border-blue-500">
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            ⚠️ Bitte wählen Sie zuerst eine Beleg-Option
                                        </p>
                                    </div>
                                </div>
                            )}
                            <Card className="border-none shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 dark:border dark:border-blue-900/50">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                                            <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg text-blue-900 dark:text-blue-100">Schnelleingabe</CardTitle>
                                            <CardDescription className="text-blue-700 dark:text-blue-300">
                                                Automatische Generierung von Buchungssätzen
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
                                        <div className="col-span-2 md:col-span-1 lg:col-span-2">
                                            <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                                Kontakt *
                                            </label>
                                            <ContactSelector
                                                contacts={contacts}
                                                value={quickEntry.contact_id}
                                                onChange={(value) => setQuickEntry(prev => ({ ...prev, contact_id: value }))}
                                            />
                                        </div>

                                        <div className="col-span-2 md:col-span-1 lg:col-span-2">
                                            <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                                Gegenkonto *
                                            </label>
                                            <AccountSelector
                                                accounts={accounts}
                                                value={quickEntry.contra_account_id}
                                                onChange={(value) => setQuickEntry(prev => ({ ...prev, contra_account_id: value }))}
                                                filterType={['revenue', 'expense']}
                                                placeholder="Erlös-/Aufwandskonto..."
                                            />
                                        </div>

                                        <div className="col-span-1">
                                            <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                                MwSt *
                                            </label>
                                            <Select
                                                value={quickEntry.vat_rate}
                                                onValueChange={(value) => setQuickEntry(prev => ({ ...prev, vat_rate: value }))}
                                            >
                                                <SelectTrigger className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="19">19%</SelectItem>
                                                    <SelectItem value="7">7%</SelectItem>
                                                    <SelectItem value="0">0%</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="col-span-1">
                                            <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                                Betrag (€) *
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={quickEntry.gross_amount}
                                                onChange={(e) => setQuickEntry(prev => ({ ...prev, gross_amount: e.target.value }))}
                                                className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-10"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="is_paid"
                                                checked={quickEntry.is_paid}
                                                onCheckedChange={(checked) => setQuickEntry(prev => ({ ...prev, is_paid: !!checked }))}
                                                className="border-blue-400 data-[state=checked]:bg-blue-600"
                                            />
                                            <label
                                                htmlFor="is_paid"
                                                className="text-sm font-medium leading-none text-slate-700 dark:text-slate-300 cursor-pointer"
                                            >
                                                Als "Bezahlt" markieren
                                            </label>
                                            {quickEntry.is_paid && (
                                                <div className="w-[200px] ml-4">
                                                    <AccountSelector
                                                        accounts={accounts}
                                                        value={quickEntry.payment_account_id}
                                                        onChange={(value) => setQuickEntry(prev => ({ ...prev, payment_account_id: value }))}
                                                        filterType={['asset']}
                                                        placeholder="Kasse/Bank..."
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={handleQuickEntry}
                                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                        >
                                            <Zap className="w-4 h-4 mr-2" />
                                            Übernehmen
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Manual Entry Form */}
                        <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle>Buchungsdetails</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                        {/* Header Data */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="date"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-slate-700 dark:text-slate-300">Datum *</FormLabel>
                                                        <FormControl>
                                                            <Input type="date" {...field} className="bg-white dark:bg-slate-950" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="description"
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-2">
                                                        <FormLabel className="text-slate-700 dark:text-slate-300">Beschreibung *</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="z.B. Büromaterial Einkauf bei Müller" {...field} className="bg-white dark:bg-slate-950" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        {/* Lines */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Buchungszeilen</h3>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => append({ account_id: '', type: 'debit', amount: 0 })}
                                                    className="bg-white dark:bg-slate-950"
                                                >
                                                    <Plus className="w-4 h-4 mr-2" /> Zeile hinzufügen
                                                </Button>
                                            </div>

                                            <div className="space-y-3">
                                                {fields.map((field, index) => (
                                                    <div key={field.id} className="group relative grid grid-cols-12 gap-4 p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                                                        {/* Account */}
                                                        <div className="col-span-12 md:col-span-5">
                                                            <FormField
                                                                control={form.control}
                                                                name={`lines.${index}.account_id`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs text-slate-500 dark:text-slate-400">Konto</FormLabel>
                                                                        <FormControl>
                                                                            <AccountSelector
                                                                                accounts={accounts}
                                                                                value={field.value}
                                                                                onChange={field.onChange}
                                                                                placeholder="Konto wählen..."
                                                                            />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>

                                                        {/* Type */}
                                                        <div className="col-span-6 md:col-span-3">
                                                            <FormField
                                                                control={form.control}
                                                                name={`lines.${index}.type`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs text-slate-500 dark:text-slate-400">Typ</FormLabel>
                                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                                            <FormControl>
                                                                                <SelectTrigger className={`h-10 ${field.value === 'debit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} bg-white dark:bg-slate-950`}>
                                                                                    <SelectValue />
                                                                                </SelectTrigger>
                                                                            </FormControl>
                                                                            <SelectContent>
                                                                                <SelectItem value="debit" className="text-emerald-600">Soll</SelectItem>
                                                                                <SelectItem value="credit" className="text-rose-600">Haben</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>

                                                        {/* Amount */}
                                                        <div className="col-span-6 md:col-span-3">
                                                            <FormField
                                                                control={form.control}
                                                                name={`lines.${index}.amount`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel className="text-xs text-slate-500 dark:text-slate-400">Betrag (€)</FormLabel>
                                                                        <FormControl>
                                                                            <Input
                                                                                type="number"
                                                                                step="0.01"
                                                                                {...field}
                                                                                value={field.value ? roundToTwoDecimals(parseFloat(String(field.value))) : ''}
                                                                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                                                className="h-10 font-mono text-right bg-white dark:bg-slate-950"
                                                                            />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>

                                                        {/* Delete */}
                                                        <div className="col-span-12 md:col-span-1 flex items-end justify-end pb-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => remove(index)}
                                                                disabled={fields.length <= 2}
                                                                className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {form.formState.errors.lines?.root && (
                                                <p className="text-rose-500 text-sm font-medium">{form.formState.errors.lines.root.message}</p>
                                            )}
                                        </div>

                                        {/* Footer Actions */}
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                                            {/* Balance Indicator */}
                                            <div className={`flex items-center gap-6 px-4 py-2 rounded-full ${isBalanced ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'}`}>
                                                <div className="text-sm">
                                                    <span className="opacity-70 mr-2">Soll:</span>
                                                    <span className="font-mono font-bold">{formatEuro(debitSum)}</span>
                                                </div>
                                                <div className="h-4 w-px bg-current opacity-20" />
                                                <div className="text-sm">
                                                    <span className="opacity-70 mr-2">Haben:</span>
                                                    <span className="font-mono font-bold">{formatEuro(creditSum)}</span>
                                                </div>
                                                <div className="h-4 w-px bg-current opacity-20" />
                                                <div className="text-sm font-medium flex items-center gap-1.5">
                                                    {isBalanced ? (
                                                        <><span>✓</span> Ausgeglichen</>
                                                    ) : (
                                                        <><span>!</span> Differenz: {formatEuro(Math.abs(debitSum - creditSum))}</>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 w-full md:w-auto">
                                                <Button type="button" variant="outline" onClick={() => navigate(`/${tenant}/bookings`)} className="flex-1 md:flex-none">
                                                    Abbrechen
                                                </Button>
                                                <Button type="submit" disabled={!isBalanced || createMutation.isPending} className="flex-1 md:flex-none min-w-[140px]">
                                                    {createMutation.isPending ? 'Speichert...' : 'Buchung speichern'}
                                                </Button>
                                            </div>
                                        </div>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Dialog for Attach File */}
                <Dialog open={showBelegDialog && selectedBelegOption === 'attach'} onOpenChange={(open) => {
                    if (!open) {
                        setShowBelegDialog(false);
                        if (!newBelegId) {
                            setSelectedBelegOption('none');
                        }
                    }
                }}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Beleg anhängen</DialogTitle>
                            <DialogDescription>
                                Laden Sie eine Datei hoch um einen neuen Beleg zu erstellen
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center">
                                <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                    Ziehen Sie eine Datei hierher oder klicken Sie um eine auszuwählen
                                </p>
                                <Input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="mt-2"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            // TODO: Implement file upload
                                            alert('Datei-Upload wird implementiert: ' + file.name);
                                            setShowBelegDialog(false);
                                            setBelegStep('complete');
                                        }
                                    }}
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    PDF, JPG oder PNG (max. 10MB)
                                </p>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Dialog for Select Existing Beleg */}
                <Dialog open={showBelegDialog && selectedBelegOption === 'select'} onOpenChange={(open) => {
                    if (!open) {
                        setShowBelegDialog(false);
                        if (!selectedBelegId) {
                            setSelectedBelegOption('none');
                        }
                    }
                }}>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
                        <DialogHeader>
                            <DialogTitle>Bestehenden Beleg auswählen</DialogTitle>
                            <DialogDescription>
                                Wählen Sie einen vorhandenen Beleg aus der Liste
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-4">
                            {belege && belege.length > 0 ? (
                                belege
                                    .filter((beleg: any) => beleg.status === 'draft' || beleg.status === 'booked')
                                    .map((beleg: any) => (
                                        <button
                                            key={beleg.id}
                                            onClick={() => {
                                                setSelectedBelegId(String(beleg.id));
                                                setShowBelegDialog(false);
                                                setBelegStep('complete');
                                            }}
                                            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${selectedBelegId === String(beleg.id)
                                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                                                            {beleg.document_number}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${beleg.status === 'draft'
                                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                                            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                                            }`}>
                                                            {beleg.status === 'draft' ? 'Entwurf' : 'Gebucht'}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                                                        {beleg.title}
                                                    </h4>
                                                    <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                                                        <span>{new Date(beleg.document_date).toLocaleDateString('de-DE')}</span>
                                                        <span className="font-mono font-semibold">
                                                            {(beleg.amount / 100).toFixed(2)} €
                                                        </span>
                                                    </div>
                                                </div>
                                                {selectedBelegId === String(beleg.id) && (
                                                    <Check className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                                )}
                                            </div>
                                        </button>
                                    ))
                            ) : (
                                <div className="text-center py-12">
                                    <FileText className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-700 mb-4" />
                                    <p className="text-slate-600 dark:text-slate-400">
                                        Keine Belege gefunden
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="mt-4"
                                        onClick={() => {
                                            window.open(`/${tenant}/belege/create`, '_blank');
                                        }}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Neuen Beleg erstellen
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Dialog for Create New Beleg - Instructions */}
                <Dialog open={showBelegDialog && selectedBelegOption === 'create'} onOpenChange={(open) => {
                    if (!open) {
                        setShowBelegDialog(false);
                    }
                }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Neuen Beleg erstellen</DialogTitle>
                            <DialogDescription>
                                Der Beleg-Editor wurde in einem neuen Fenster geöffnet
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                    Nächste Schritte:
                                </h4>
                                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
                                    <li>Füllen Sie das Beleg-Formular im neuen Fenster aus</li>
                                    <li>Speichern Sie den Beleg als Entwurf</li>
                                    <li>Kehren Sie zu dieser Seite zurück</li>
                                    <li>Klicken Sie auf "Beleg erstellt" um fortzufahren</li>
                                </ol>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setShowBelegDialog(false);
                                        setSelectedBelegOption('none');
                                    }}
                                >
                                    Abbrechen
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => {
                                        setShowBelegDialog(false);
                                        setBelegStep('complete');
                                    }}
                                >
                                    <Check className="w-4 h-4 mr-2" />
                                    Beleg erstellt
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
