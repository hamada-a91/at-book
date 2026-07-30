<?php

namespace App\Services\Banking;

use App\Models\BankTransaction;
use App\Models\Beleg;
use App\Models\Invoice;
use App\Models\Payment;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\AuditLog;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Services\BookingService;
use App\Modules\Accounting\Services\PaymentService;
use DomainException;
use Illuminate\Support\Facades\DB;

class BankReconciliationService
{
    public function __construct(
        private PaymentService $paymentService,
        private BookingService $bookingService,
    ) {}

    public function assign(BankTransaction $transaction, array $data): BankTransaction
    {
        return DB::transaction(function () use ($transaction, $data) {
            $transaction = BankTransaction::query()->whereKey($transaction->id)->lockForUpdate()->firstOrFail();
            $this->assertUnmatched($transaction);

            $targetType = $data['target_type'];
            $journalEntryId = null;
            $matchedId = null;

            if ($targetType === 'invoice') {
                $invoice = Invoice::where('tenant_id', $transaction->tenant_id)->findOrFail($data['target_id']);
                if ($transaction->amount <= 0) {
                    throw new DomainException('Rechnungen können nur Zahlungseingängen zugeordnet werden.');
                }

                $payment = $this->paymentService->recordPayment(
                    $invoice,
                    $transaction->amount_abs,
                    $transaction->booking_date->toDateString(),
                    $this->paymentAccountId($transaction),
                    $transaction->id,
                    isset($data['discount_amount']) ? (int) $data['discount_amount'] : null,
                    isset($data['discount_account_id']) ? (int) $data['discount_account_id'] : null,
                    $data['note'] ?? null,
                );
                $journalEntryId = $payment->journal_entry_id;
                $matchedId = $invoice->id;
            } elseif ($targetType === 'beleg') {
                $beleg = Beleg::where('tenant_id', $transaction->tenant_id)->findOrFail($data['target_id']);
                if (($beleg->document_type === 'ausgang' && $transaction->amount <= 0)
                    || ($beleg->document_type !== 'ausgang' && $transaction->amount >= 0)) {
                    throw new DomainException('Bankumsatz-Vorzeichen passt nicht zum Belegtyp.');
                }

                $payment = $this->paymentService->recordPayment(
                    $beleg,
                    $transaction->amount_abs,
                    $transaction->booking_date->toDateString(),
                    $this->paymentAccountId($transaction),
                    $transaction->id,
                    isset($data['discount_amount']) ? (int) $data['discount_amount'] : null,
                    isset($data['discount_account_id']) ? (int) $data['discount_account_id'] : null,
                    $data['note'] ?? null,
                );
                $journalEntryId = $payment->journal_entry_id;
                $matchedId = $beleg->id;
            } elseif ($targetType === 'category') {
                $entry = $this->bookCategory($transaction, $data);
                $journalEntryId = $entry->id;
                $matchedId = (int) $data['account_id'];
            } else {
                throw new DomainException('Unbekannter Zuordnungstyp.');
            }

            $old = $transaction->only(['status', 'matched_type', 'matched_id', 'journal_entry_id']);
            $transaction->update([
                'status' => BankTransaction::STATUS_MATCHED,
                'matched_type' => $targetType,
                'matched_id' => $matchedId,
                'journal_entry_id' => $journalEntryId,
                'notes' => $data['note'] ?? $transaction->notes,
            ]);

            AuditLog::record($transaction, 'bank_tx_assigned', $old, [
                'status' => $transaction->status,
                'matched_type' => $transaction->matched_type,
                'matched_id' => $transaction->matched_id,
                'journal_entry_public_id' => $transaction->journalEntry?->public_id,
            ]);

            return $transaction->fresh(['bankAccount.account', 'journalEntry']);
        });
    }

    public function ignore(BankTransaction $transaction, ?string $note = null): BankTransaction
    {
        return DB::transaction(function () use ($transaction, $note) {
            $transaction = BankTransaction::query()->whereKey($transaction->id)->lockForUpdate()->firstOrFail();
            $this->assertUnmatched($transaction);
            $old = $transaction->only(['status', 'notes']);

            $transaction->update([
                'status' => BankTransaction::STATUS_IGNORED,
                'notes' => $note ?? $transaction->notes,
            ]);

            AuditLog::record($transaction, 'bank_tx_ignored', $old, $transaction->only(['status', 'notes']));

            return $transaction->fresh(['bankAccount.account']);
        });
    }

    public function unassign(BankTransaction $transaction): BankTransaction
    {
        return DB::transaction(function () use ($transaction) {
            $transaction = BankTransaction::query()->whereKey($transaction->id)->lockForUpdate()->firstOrFail();
            if ($transaction->status !== BankTransaction::STATUS_MATCHED || ! $transaction->journal_entry_id) {
                throw new DomainException('Nur zugeordnete Umsätze können aufgehoben werden.');
            }

            $old = $transaction->only(['status', 'matched_type', 'matched_id', 'journal_entry_id']);

            if (in_array($transaction->matched_type, ['invoice', 'beleg'], true)) {
                $payment = Payment::where('bank_transaction_id', $transaction->id)->firstOrFail();
                $this->paymentService->reversePayment($payment, false);
            } else {
                $this->bookingService->reverseBooking($transaction->journal_entry_id, false);
            }

            $transaction->update([
                'status' => BankTransaction::STATUS_UNMATCHED,
                'matched_type' => null,
                'matched_id' => null,
                'journal_entry_id' => null,
            ]);

            AuditLog::record($transaction, 'bank_tx_unassigned', $old, $transaction->only(['status', 'matched_type', 'matched_id', 'journal_entry_id']));

            return $transaction->fresh(['bankAccount.account']);
        });
    }

    private function bookCategory(BankTransaction $transaction, array $data): JournalEntry
    {
        $account = Account::where('tenant_id', $transaction->tenant_id)->findOrFail($data['account_id']);
        // Eigenkapital (equity) zusätzlich erlaubt: Geldeingang -> Privateinlage/
        // Kapitalrücklage, Geldabgang -> Privatentnahme. Die Buchungslogik unten
        // (debit/credit gegen das Bankkonto) stimmt für equity genauso.
        if (! in_array($account->type, ['expense', 'revenue', 'equity'], true)) {
            throw new DomainException('Als Kategorie ist nur ein Aufwands-, Erlös- oder Eigenkapitalkonto erlaubt.');
        }
        if ($transaction->amount < 0 && ! in_array($account->type, ['expense', 'equity'], true)) {
            throw new DomainException('Ausgaben müssen einem Aufwands- oder Eigenkapitalkonto (z.B. Privatentnahme) zugeordnet werden.');
        }
        if ($transaction->amount > 0 && ! in_array($account->type, ['revenue', 'equity'], true)) {
            throw new DomainException('Einnahmen müssen einem Erlös- oder Eigenkapitalkonto (z.B. Privateinlage) zugeordnet werden.');
        }

        $gross = $transaction->amount_abs;
        $taxAmount = (int) ($data['tax_amount'] ?? 0);
        $taxAccountId = $data['tax_account_id'] ?? null;
        if ($taxAmount < 0 || $taxAmount >= $gross) {
            throw new DomainException('Steuerbetrag ist ungültig.');
        }
        if ($taxAmount > 0 && ! $taxAccountId) {
            throw new DomainException('Bei Steuerbetrag muss ein Steuerkonto angegeben werden.');
        }

        $net = $gross - $taxAmount;
        $bankAccountId = $this->paymentAccountId($transaction);
        $costCenterId = $data['cost_center_id'] ?? null;
        $costObjectId = $data['cost_object_id'] ?? null;

        if ($transaction->amount < 0) {
            $lines = [
                ['account_id' => $account->id, 'type' => 'debit', 'amount' => $net, 'tax_amount' => $taxAmount, 'cost_center_id' => $costCenterId, 'cost_object_id' => $costObjectId],
            ];
            if ($taxAmount > 0) {
                $lines[] = ['account_id' => (int) $taxAccountId, 'type' => 'debit', 'amount' => $taxAmount, 'cost_object_id' => $costObjectId];
            }
            $lines[] = ['account_id' => $bankAccountId, 'type' => 'credit', 'amount' => $gross];
        } else {
            $lines = [['account_id' => $bankAccountId, 'type' => 'debit', 'amount' => $gross]];
            $lines[] = ['account_id' => $account->id, 'type' => 'credit', 'amount' => $net, 'tax_amount' => $taxAmount, 'cost_center_id' => $costCenterId, 'cost_object_id' => $costObjectId];
            if ($taxAmount > 0) {
                $lines[] = ['account_id' => (int) $taxAccountId, 'type' => 'credit', 'amount' => $taxAmount, 'cost_object_id' => $costObjectId];
            }
        }

        $entry = $this->bookingService->createBooking([
            'date' => $transaction->booking_date->toDateString(),
            'description' => 'Bankumsatz: '.($transaction->purpose ?: $transaction->counterparty ?: 'Kategorie'),
            'lines' => $lines,
        ]);
        $this->bookingService->lockBooking($entry->id);

        return $entry->fresh('lines');
    }

    private function paymentAccountId(BankTransaction $transaction): int
    {
        $transaction->loadMissing('bankAccount');
        $accountId = $transaction->bankAccount?->account_id;
        if (! $accountId) {
            throw new DomainException('Das Bankkonto hat kein Sachkonto.');
        }

        return (int) $accountId;
    }

    private function assertUnmatched(BankTransaction $transaction): void
    {
        if ($transaction->status !== BankTransaction::STATUS_UNMATCHED) {
            throw new DomainException('Nur offene Bankumsätze können zugeordnet werden.');
        }
    }
}
