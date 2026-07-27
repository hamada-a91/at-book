import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AccountSelector } from '@/components/AccountSelector';
import { CreditCard, RotateCcw } from 'lucide-react';

type Props = {
    resource: 'invoices' | 'belege';
    payableId: string | number;
    documentLabel: string;
    amountPaid: number;
    openAmount: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChanged: () => void;
    showCard?: boolean;
};

const DISCOUNT_TOLERANCE_PERCENT = 2;

const formatCurrency = (cents: number) => new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
}).format(cents / 100);

const toCents = (value: string) => Math.round((Number.parseFloat(value.replace(',', '.')) || 0) * 100);

export function PaymentManagement(props: Props) {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [accountId, setAccountId] = useState('');
    const [discount, setDiscount] = useState('0');
    const [discountAccountId, setDiscountAccountId] = useState('');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (props.open) {
            setAmount((props.openAmount / 100).toFixed(2));
            setDiscount('0');
            setDiscountAccountId('');
        }
    }, [props.open, props.openAmount]);

    const paymentsQuery = useQuery({
        queryKey: ['payments', props.resource, props.payableId],
        queryFn: async () => (await axios.get(`/api/${props.resource}/${props.payableId}/payments`)).data,
    });
    const accountsQuery = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await axios.get('/api/accounts')).data,
    });

    const accounts = accountsQuery.data || [];
    const paymentAccounts = accounts
        .filter((account: any) =>
            account.type === 'asset' && /^(10|12)\d{2}$/.test(String(account.code))
        )
        .sort((a: any, b: any) => String(a.code).localeCompare(String(b.code)));
    const discountAccounts = accounts
        .filter((account: any) => ['expense', 'revenue'].includes(account.type))
        .sort((a: any, b: any) => String(a.code).localeCompare(String(b.code)));

    const amountCents = toCents(amount);
    const discountCents = toCents(discount);
    const maxDiscountCents = Math.floor(props.openAmount * DISCOUNT_TOLERANCE_PERCENT / 100);
    const discountTooHigh = discountCents > maxDiscountCents;
    const settlementTooHigh = amountCents + discountCents > props.openAmount;

    const recordMutation = useMutation({
        mutationFn: async () => (await axios.post(`/api/${props.resource}/${props.payableId}/payments`, {
            amount: amountCents,
            payment_date: date,
            payment_account_id: Number(accountId),
            discount_amount: discountCents,
            discount_account_id: discountCents > 0 ? Number(discountAccountId) : null,
            note: note || null,
        })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments', props.resource, props.payableId] });
            queryClient.invalidateQueries({ queryKey: ['open-items'] });
            props.onOpenChange(false);
            props.onChanged();
            setNote('');
        },
    });

    const reverseMutation = useMutation({
        mutationFn: async (paymentId: number) => (await axios.delete(`/api/payments/${paymentId}`)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments', props.resource, props.payableId] });
            queryClient.invalidateQueries({ queryKey: ['open-items'] });
            props.onChanged();
        },
    });

    const error = (recordMutation.error as any)?.response?.data?.error
        || (recordMutation.error as any)?.response?.data?.message;
    const reverseError = (reverseMutation.error as any)?.response?.data?.error
        || (reverseMutation.error as any)?.response?.data?.message;

    return (
        <>
            {props.showCard !== false && (
                <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CreditCard className="h-5 w-5" />
                            Zahlungen
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Bereits ausgeglichen</span>
                            <span>{formatCurrency(props.amountPaid)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                            <span>Offener Betrag</span>
                            <span className={props.openAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                                {formatCurrency(props.openAmount)}
                            </span>
                        </div>
                        {props.openAmount > 0 && (
                            <Button className="w-full gap-2" onClick={() => props.onOpenChange(true)}>
                                <CreditCard className="h-4 w-4" />
                                Zahlung erfassen
                            </Button>
                        )}
                        <div className="space-y-2 border-t pt-3">
                            {(paymentsQuery.data || []).map((payment: any) => (
                                <div key={payment.id} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="font-medium">
                                                {formatCurrency(payment.amount)}
                                                {payment.discount_amount > 0 && ` + ${formatCurrency(payment.discount_amount)} Skonto`}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {new Date(payment.payment_date).toLocaleDateString('de-DE')} · {payment.payment_account?.name}
                                            </div>
                                        </div>
                                        {payment.reversed_at ? (
                                            <Badge variant="outline">Storniert</Badge>
                                        ) : (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="shrink-0 gap-1.5"
                                                title="Zahlung stornieren"
                                                disabled={reverseMutation.isPending}
                                                onClick={() => confirm('Zahlung per Generalumkehr stornieren?') && reverseMutation.mutate(payment.id)}
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                                Zahlung stornieren
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {reverseError && (
                                <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{reverseError}</p>
                            )}
                            {!paymentsQuery.isLoading && !(paymentsQuery.data || []).length && (
                                <p className="text-sm text-slate-500">Noch keine Zahlungen erfasst.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Dialog open={props.open} onOpenChange={props.onOpenChange}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Zahlung erfassen</DialogTitle>
                        <DialogDescription>
                            {props.documentLabel} · offen {formatCurrency(props.openAmount)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label htmlFor="payment-amount">
                                Zahlbetrag in EUR <span className="text-red-600">*</span>
                            </Label>
                            <Input
                                id="payment-amount"
                                inputMode="decimal"
                                value={amount}
                                onChange={(event) => setAmount(event.target.value)}
                                aria-required="true"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>
                                Zahlungskonto <span className="text-red-600">*</span>
                            </Label>
                            <Select value={accountId} onValueChange={setAccountId}>
                                <SelectTrigger aria-required="true"><SelectValue placeholder="Kasse oder Bank wählen" /></SelectTrigger>
                                <SelectContent position="popper">
                                    {paymentAccounts.map((account: any) => (
                                        <SelectItem key={account.id} value={String(account.id)}>{account.code} · {account.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="payment-date">
                                Zahlungsdatum <span className="text-red-600">*</span>
                            </Label>
                            <Input
                                id="payment-date"
                                type="date"
                                value={date}
                                onChange={(event) => setDate(event.target.value)}
                                aria-required="true"
                            />
                        </div>
                        <div className="rounded-lg border bg-slate-50 p-3 dark:bg-slate-900">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="payment-discount">
                                        Skonto in EUR <span className="font-normal text-slate-500">(optional)</span>
                                    </Label>
                                    <Input
                                        id="payment-discount"
                                        inputMode="decimal"
                                        value={discount}
                                        onChange={(event) => setDiscount(event.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>
                                        Skontokonto
                                        {discountCents > 0 && <span className="text-red-600"> *</span>}
                                    </Label>
                                    <AccountSelector
                                        accounts={discountAccounts}
                                        value={discountAccountId}
                                        onChange={setDiscountAccountId}
                                        placeholder={discountCents > 0 ? 'Skontokonto suchen…' : 'Zuerst Skonto eingeben'}
                                        filterType={['expense', 'revenue']}
                                        disabled={discountCents <= 0}
                                    />
                                </div>
                            </div>
                            <div className="mt-3 space-y-1 text-xs text-slate-500">
                                <p>
                                    <strong className="text-slate-700 dark:text-slate-300">Was ist Skonto?</strong>{' '}
                                    Ein vereinbarter Rabatt für schnelle Zahlung. Beispiel: Bei 100,00 € Rechnung und 2 % Skonto überweisen Sie 98,00 € und tragen 2,00 € Skonto ein.
                                </p>
                                <p>
                                    Ohne vereinbarten Skonto tragen Sie 0,00 € ein; ein nicht gezahlter Rest bleibt offen. Für diesen Posten sind höchstens {formatCurrency(maxDiscountCents)} ({DISCOUNT_TOLERANCE_PERCENT} %) erlaubt.
                                </p>
                                <p>
                                    AT-Book bucht den Rabatt auf das gewählte Aufwands-/Erlöskonto – nicht auf Bank oder Kasse.
                                </p>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="payment-note">
                                Notiz <span className="font-normal text-slate-500">(optional)</span>
                            </Label>
                            <Textarea id="payment-note" value={note} onChange={(event) => setNote(event.target.value)} />
                        </div>
                        {discountTooHigh && (
                            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                Skonto darf bei diesem offenen Betrag maximal {formatCurrency(maxDiscountCents)} betragen.
                            </p>
                        )}
                        {settlementTooHigh && (
                            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                Zahlung und Skonto dürfen zusammen den offenen Betrag von {formatCurrency(props.openAmount)} nicht überschreiten.
                            </p>
                        )}
                        {error && (
                            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => props.onOpenChange(false)}>Abbrechen</Button>
                        <Button
                            disabled={
                                recordMutation.isPending
                                || !accountId
                                || !date
                                || amountCents <= 0
                                || discountTooHigh
                                || settlementTooHigh
                                || (discountCents > 0 && !discountAccountId)
                            }
                            onClick={() => recordMutation.mutate()}
                        >
                            {recordMutation.isPending ? 'Wird gebucht…' : 'Zahlung buchen'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
