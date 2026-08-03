import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { LifeBuoy, Send, Loader2, CheckCircle2 } from 'lucide-react';
import axios from '@/lib/axios';

interface SupportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SupportModal({ open, onOpenChange }: SupportModalProps) {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isPending, setIsPending] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim()) {
            setError('Bitte geben Sie einen Betreff ein.');
            return;
        }
        if (!message.trim() || message.trim().length < 10) {
            setError('Die Nachricht muss mindestens 10 Zeichen lang sein.');
            return;
        }

        setIsPending(true);
        setError(null);

        try {
            await axios.post('/api/support/send', {
                subject,
                message,
            });
            setSubmitted(true);
            setSubject('');
            setMessage('');
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || 'Fehler beim Senden der Support-Anfrage.');
        } finally {
            setIsPending(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        // Reset success state after closing
        setTimeout(() => {
            setSubmitted(false);
            setError(null);
        }, 300);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border border-blue-100 dark:border-slate-800 shadow-2xl rounded-2xl">
                {!submitted ? (
                    <form onSubmit={handleSend} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
                                <LifeBuoy className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-pulse" />
                                Support kontaktieren
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 dark:text-slate-400 text-sm">
                                Haben Sie eine Frage oder ein Anliegen? Senden Sie eine E-Mail direkt an unseren Administrator.
                            </DialogDescription>
                        </DialogHeader>

                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-900/50">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4 py-2">
                            {/* Subject */}
                            <div className="space-y-2">
                                <Label htmlFor="support-subject" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Betreff <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    id="support-subject"
                                    type="text"
                                    placeholder="Worum geht es?"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500"
                                    disabled={isPending}
                                    required
                                />
                            </div>

                            {/* Message */}
                            <div className="space-y-2">
                                <Label htmlFor="support-message" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Nachricht <span className="text-rose-500">*</span>
                                </Label>
                                <Textarea
                                    id="support-message"
                                    placeholder="Beschreiben Sie Ihr Anliegen so detailliert wie möglich..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 min-h-[120px]"
                                    disabled={isPending}
                                    required
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleClose}
                                disabled={isPending}
                                className="text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                Abbrechen
                            </Button>
                            <Button
                                type="submit"
                                disabled={isPending}
                                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium shadow-md shadow-blue-500/10"
                            >
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Wird gesendet...
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        Anfrage senden
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                ) : (
                    <div className="py-6 flex flex-col items-center text-center space-y-4">
                        <div className="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50 shadow-inner">
                            <CheckCircle2 className="h-10 w-10 text-emerald-500 animate-bounce" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">Erfolgreich gesendet!</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                                Ihre Support-Anfrage wurde erfolgreich an den Administrator übermittelt. Wir kümmern uns umgehend darum.
                            </p>
                        </div>
                        <Button
                            onClick={handleClose}
                            className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-950 text-white font-semibold px-6 rounded-lg transition-colors"
                        >
                            Schließen
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
