import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Send, Mail, FileText, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SendEmailModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documentType: 'invoice' | 'quote' | 'order';
    documentNumber: string;
    customerEmail?: string;
    customerName?: string;
    companyName?: string;
    onSend: (data: EmailData) => Promise<void>;
    isPending?: boolean;
}

export interface EmailData {
    to: string;
    cc: string;
    subject: string;
    body: string;
    signature: string;
}

const documentLabels = {
    invoice: { de: 'Rechnung', subjectPrefix: 'Rechnung' },
    quote: { de: 'Angebot', subjectPrefix: 'Angebot' },
    order: { de: 'Auftragsbestätigung', subjectPrefix: 'Auftragsbestätigung' },
};

export function SendEmailModal({
    open,
    onOpenChange,
    documentType,
    documentNumber,
    customerEmail = '',
    customerName = '',
    companyName = '',
    onSend,
    isPending = false,
}: SendEmailModalProps) {
    const labels = documentLabels[documentType];

    const [emailData, setEmailData] = useState<EmailData>({
        to: '',
        cc: '',
        subject: '',
        body: '',
        signature: '',
    });

    // Initialize form data when modal opens
    useEffect(() => {
        if (open) {
            setEmailData({
                to: customerEmail,
                cc: '',
                subject: `${labels.subjectPrefix} ${documentNumber}`,
                body: getDefaultBody(),
                signature: getDefaultSignature(),
            });
        }
    }, [open, customerEmail, documentNumber, labels.subjectPrefix]);

    const getDefaultBody = () => {
        switch (documentType) {
            case 'invoice':
                return `Sehr geehrte Damen und Herren,

anbei erhalten Sie unsere ${labels.de} ${documentNumber}.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen`;
            case 'quote':
                return `Sehr geehrte Damen und Herren,

vielen Dank für Ihre Anfrage. Anbei erhalten Sie unser ${labels.de} ${documentNumber}.

Wir freuen uns auf Ihre Rückmeldung.

Mit freundlichen Grüßen`;
            case 'order':
                return `Sehr geehrte Damen und Herren,

vielen Dank für Ihren Auftrag. Anbei erhalten Sie Ihre ${labels.de} ${documentNumber}.

Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen`;
            default:
                return '';
        }
    };

    const getDefaultSignature = () => {
        return companyName || '';
    };

    const handleSend = async () => {
        if (!emailData.to) {
            alert('Bitte geben Sie eine E-Mail-Adresse ein.');
            return;
        }
        await onSend(emailData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-primary" />
                        {labels.de} versenden
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{documentNumber}</span>
                        {customerName && (
                            <>
                                <span className="text-slate-400">•</span>
                                <span>{customerName}</span>
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* To */}
                    <div className="space-y-2">
                        <Label htmlFor="to" className="text-sm font-medium">
                            An <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                            id="to"
                            type="email"
                            placeholder="empfaenger@beispiel.de"
                            value={emailData.to}
                            onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                            className="bg-white dark:bg-slate-950"
                        />
                    </div>

                    {/* CC */}
                    <div className="space-y-2">
                        <Label htmlFor="cc" className="text-sm font-medium">
                            CC <span className="text-slate-400">(optional)</span>
                        </Label>
                        <Input
                            id="cc"
                            type="email"
                            placeholder="cc@beispiel.de"
                            value={emailData.cc}
                            onChange={(e) => setEmailData({ ...emailData, cc: e.target.value })}
                            className="bg-white dark:bg-slate-950"
                        />
                    </div>

                    {/* Subject */}
                    <div className="space-y-2">
                        <Label htmlFor="subject" className="text-sm font-medium">
                            Betreff <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                            id="subject"
                            value={emailData.subject}
                            onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                            className="bg-white dark:bg-slate-950"
                        />
                    </div>

                    {/* Body */}
                    <div className="space-y-2">
                        <Label htmlFor="body" className="text-sm font-medium">
                            Nachricht
                        </Label>
                        <Textarea
                            id="body"
                            value={emailData.body}
                            onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                            rows={8}
                            className="bg-white dark:bg-slate-950 resize-none"
                        />
                    </div>

                    {/* Signature */}
                    <div className="space-y-2">
                        <Label htmlFor="signature" className="text-sm font-medium">
                            Signatur
                        </Label>
                        <Textarea
                            id="signature"
                            value={emailData.signature}
                            onChange={(e) => setEmailData({ ...emailData, signature: e.target.value })}
                            rows={3}
                            placeholder="Ihre Signatur..."
                            className="bg-white dark:bg-slate-950 resize-none"
                        />
                    </div>

                    {/* Attachment Info */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <FileText className="w-4 h-4" />
                            <span>Anhang:</span>
                            <Badge variant="outline" className="bg-white dark:bg-slate-900">
                                {documentNumber}.pdf
                            </Badge>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isPending}
                    >
                        Abbrechen
                    </Button>
                    <Button
                        onClick={handleSend}
                        disabled={isPending || !emailData.to || !emailData.subject}
                        className="gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Wird gesendet...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Senden
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
