<?php

namespace App\Modules\Accounting\Services;

use App\Models\BankTransaction;
use App\Models\Beleg;
use App\Models\Invoice;
use App\Models\Payment;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AuditLog;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PaymentService
{
    public function __construct(private BookingService $bookingService) {}

    public function recordPayment(
        Model $payable,
        int $amount,
        string $date,
        int $paymentAccountId,
        ?int $bankTransactionId = null,
        ?int $discountAmount = null,
        ?int $discountAccountId = null,
        ?string $note = null,
    ): Payment {
        return DB::transaction(function () use ($payable, $amount, $date, $paymentAccountId, $bankTransactionId, $discountAmount, $discountAccountId, $note) {
            $payable = $payable::query()->whereKey($payable->getKey())->lockForUpdate()->firstOrFail();
            $this->assertSupported($payable);
            $this->assertPayable($payable);
            $this->bookingService->assertPeriodOpen($date);

            $discountAmount ??= 0;
            $openAmount = max(0, $this->total($payable) - (int) $payable->amount_paid);
            $settlementAmount = $amount + $discountAmount;

            if ($amount <= 0) {
                throw new DomainException('Der Zahlbetrag muss größer als 0 sein.');
            }
            if ($settlementAmount > $openAmount) {
                throw new DomainException('Die Summe aus Zahlung und Skonto ist größer als der offene Betrag.');
            }
            if ($discountAmount > 0 && ! $discountAccountId) {
                throw new DomainException('Bei Skonto muss ein Skontokonto angegeben werden.');
            }

            $maxDiscount = (int) floor($openAmount * ((float) config('accounting.discount_tolerance_percent', 2) / 100));
            if ($discountAmount > $maxDiscount) {
                throw new DomainException(sprintf(
                    'Skonto darf maximal %s%% des offenen Betrags betragen.',
                    config('accounting.discount_tolerance_percent', 2)
                ));
            }

            $paymentAccount = Account::findOrFail($paymentAccountId);
            if (
                $paymentAccount->type !== 'asset'
                || preg_match('/^(10|12)\d{2}$/', (string) $paymentAccount->code) !== 1
            ) {
                throw new DomainException('Als Zahlungskonto ist nur ein Kassen- oder Bankkonto erlaubt.');
            }
            if ($discountAccountId) {
                $discountAccount = Account::findOrFail($discountAccountId);
                if (! in_array($discountAccount->type, ['expense', 'revenue'], true)) {
                    throw new DomainException('Als Skontokonto ist nur ein Aufwands- oder Erlöskonto erlaubt.');
                }
            }
            $this->assertBankTransaction($bankTransactionId);

            [$personAccountId, $isIncoming] = $this->resolvePersonAccount($payable);
            $lines = $this->buildLines(
                $personAccountId,
                $isIncoming,
                $paymentAccountId,
                $amount,
                $discountAccountId,
                $discountAmount
            );

            $entry = $this->bookingService->createBooking([
                'date' => $date,
                'description' => $this->description($payable),
                'contact_id' => $payable->contact_id,
                'lines' => $lines,
            ]);
            $this->bookingService->lockBooking($entry->id);

            $payment = Payment::create([
                'payable_type' => $payable instanceof Invoice ? 'invoice' : 'beleg',
                'payable_id' => $payable->id,
                'amount' => $amount,
                'payment_date' => $date,
                'payment_account_id' => $paymentAccountId,
                'journal_entry_id' => $entry->id,
                'bank_transaction_id' => $bankTransactionId,
                'discount_amount' => $discountAmount,
                'discount_account_id' => $discountAccountId,
                'note' => $note,
            ]);

            $oldStatus = $payable->status;
            $oldPaid = (int) $payable->amount_paid;
            $newPaid = $oldPaid + $settlementAmount;
            $changes = ['amount_paid' => $newPaid];
            if ($newPaid >= $this->total($payable)) {
                $changes['status'] = 'paid';
                if ($payable instanceof Beleg) {
                    $changes['is_paid'] = true;
                    $changes['payment_account_id'] = $paymentAccountId;
                }
            }
            $payable->update($changes);

            AuditLog::record(
                $payable,
                'payment_recorded',
                ['status' => $oldStatus, 'amount_paid' => $oldPaid],
                ['status' => $payable->status, 'amount_paid' => $newPaid, 'payment_public_id' => $payment->public_id]
            );

            return $payment->fresh(['paymentAccount', 'discountAccount', 'journalEntry']);
        });
    }

    public function reversePayment(Payment $payment, bool $releaseBankTransaction = true): Payment
    {
        return DB::transaction(function () use ($payment, $releaseBankTransaction) {
            $payment = Payment::query()->whereKey($payment->getKey())->lockForUpdate()->firstOrFail();
            if ($payment->reversed_at) {
                throw new DomainException('Diese Zahlung wurde bereits storniert.');
            }

            $payableClass = $payment->payable_type === 'invoice' ? Invoice::class : Beleg::class;
            $payable = $payableClass::query()->whereKey($payment->payable_id)->lockForUpdate()->firstOrFail();
            $oldStatus = $payable->status;
            $oldPaid = (int) $payable->amount_paid;
            $reversal = $this->bookingService->reverseBooking($payment->journal_entry_id, false);

            $newPaid = max(0, $oldPaid - $payment->settlement_amount);
            $changes = ['amount_paid' => $newPaid];
            if ($newPaid < $this->total($payable) && $payable->status === 'paid') {
                $changes['status'] = 'booked';
            }
            if ($payable instanceof Beleg) {
                $changes['is_paid'] = $newPaid >= $this->total($payable);
            }
            $payable->update($changes);

            $payment->update([
                'reversal_journal_entry_id' => $reversal->id,
                'reversed_at' => now(),
            ]);

            AuditLog::record(
                $payable,
                'payment_reversed',
                ['status' => $oldStatus, 'amount_paid' => $oldPaid],
                [
                    'status' => $payable->status,
                    'amount_paid' => $newPaid,
                    'payment_public_id' => $payment->public_id,
                    'reversal_journal_entry_public_id' => $reversal->public_id,
                ]
            );

            if ($releaseBankTransaction) {
                $this->releaseBankTransactionAfterPaymentReversal($payment);
            }

            return $payment->fresh(['paymentAccount', 'discountAccount', 'journalEntry', 'reversalJournalEntry']);
        });
    }

    private function releaseBankTransactionAfterPaymentReversal(Payment $payment): void
    {
        $transaction = BankTransaction::query()
            ->where('status', BankTransaction::STATUS_MATCHED)
            ->where(function ($query) use ($payment) {
                $query->where('journal_entry_id', $payment->journal_entry_id);
                if ($payment->bank_transaction_id) {
                    $query->orWhere('id', $payment->bank_transaction_id);
                }
            })
            ->lockForUpdate()
            ->first();

        if (! $transaction) {
            return;
        }

        $old = $transaction->only(['status', 'matched_type', 'matched_id', 'journal_entry_id']);

        $transaction->update([
            'status' => BankTransaction::STATUS_UNMATCHED,
            'matched_type' => null,
            'matched_id' => null,
            'journal_entry_id' => null,
        ]);

        AuditLog::record(
            $transaction,
            'bank_tx_unassigned_by_payment_reversal',
            $old,
            $transaction->only(['status', 'matched_type', 'matched_id', 'journal_entry_id'])
        );
    }

    private function assertSupported(Model $payable): void
    {
        if (! $payable instanceof Invoice && ! $payable instanceof Beleg) {
            throw new DomainException('Dieser Dokumenttyp unterstützt keine Zahlungen.');
        }
    }

    private function assertPayable(Model $payable): void
    {
        if (! in_array($payable->status, ['booked', 'sent', 'paid'], true)) {
            throw new DomainException('Nur gebuchte oder versendete Dokumente können bezahlt werden.');
        }
        if (! $payable->contact) {
            throw new DomainException('Für eine OPOS-Zahlung ist ein Kontakt erforderlich.');
        }
    }

    private function total(Model $payable): int
    {
        return (int) ($payable instanceof Invoice ? $payable->total : $payable->amount);
    }

    /** @return array{0:int,1:bool} */
    private function resolvePersonAccount(Model $payable): array
    {
        $payable->loadMissing('contact');
        $isIncoming = $payable instanceof Beleg && $payable->document_type !== 'ausgang';
        $accountId = $isIncoming
            ? $payable->contact?->vendor_account_id
            : $payable->contact?->customer_account_id;

        if (! $accountId) {
            throw new DomainException($isIncoming ? 'Der Kontakt hat kein Kreditorenkonto.' : 'Der Kontakt hat kein Debitorenkonto.');
        }

        return [(int) $accountId, $isIncoming];
    }

    private function buildLines(
        int $personAccountId,
        bool $isIncoming,
        int $paymentAccountId,
        int $amount,
        ?int $discountAccountId,
        int $discountAmount
    ): array {
        if ($isIncoming) {
            $lines = [
                ['account_id' => $personAccountId, 'type' => 'debit', 'amount' => $amount + $discountAmount],
                ['account_id' => $paymentAccountId, 'type' => 'credit', 'amount' => $amount],
            ];
            if ($discountAmount > 0) {
                $lines[] = ['account_id' => $discountAccountId, 'type' => 'credit', 'amount' => $discountAmount];
            }

            return $lines;
        }

        $lines = [['account_id' => $paymentAccountId, 'type' => 'debit', 'amount' => $amount]];
        if ($discountAmount > 0) {
            $lines[] = ['account_id' => $discountAccountId, 'type' => 'debit', 'amount' => $discountAmount];
        }
        $lines[] = ['account_id' => $personAccountId, 'type' => 'credit', 'amount' => $amount + $discountAmount];

        return $lines;
    }

    private function description(Model $payable): string
    {
        return $payable instanceof Invoice
            ? "Zahlung Rechnung {$payable->invoice_number} - {$payable->contact->name}"
            : "Zahlung Beleg {$payable->document_number} - {$payable->contact->name}";
    }

    private function assertBankTransaction(?int $bankTransactionId): void
    {
        if (! $bankTransactionId) {
            return;
        }
        if (! Schema::hasTable('bank_transactions')) {
            throw new DomainException('Banktransaktionen stehen erst mit SPEC-12 zur Verfügung.');
        }
        $tenant = tenant();
        $exists = DB::table('bank_transactions')
            ->where('id', $bankTransactionId)
            ->when($tenant, fn ($query) => $query->where('tenant_id', $tenant->id))
            ->exists();

        if (! $exists) {
            throw new DomainException('Banktransaktion nicht gefunden.');
        }
    }
}
