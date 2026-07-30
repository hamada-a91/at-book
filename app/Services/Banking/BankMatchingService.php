<?php

namespace App\Services\Banking;

use App\Models\BankTransaction;
use App\Models\Beleg;
use App\Models\Invoice;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class BankMatchingService
{
    public function suggest(BankTransaction $transaction): array
    {
        $suggestions = collect()
            ->merge($this->invoiceSuggestions($transaction))
            ->merge($this->belegSuggestions($transaction))
            ->sortByDesc('score')
            ->values();

        return $suggestions->all();
    }

    private function invoiceSuggestions(BankTransaction $transaction): Collection
    {
        if ($transaction->amount <= 0) {
            return collect();
        }

        return Invoice::where('tenant_id', $transaction->tenant_id)
            ->whereIn('status', ['booked', 'sent', 'paid'])
            ->whereRaw('(total - amount_paid) = ?', [$transaction->amount])
            ->with('contact')
            ->get()
            ->map(function (Invoice $invoice) use ($transaction) {
                $score = 70;
                $haystack = $this->normalize(($transaction->purpose ?? '').' '.($transaction->counterparty ?? ''));

                if (str_contains($haystack, $this->normalize($invoice->invoice_number))) {
                    $score += 30;
                }
                if ($invoice->contact && str_contains($haystack, $this->normalize($invoice->contact->name))) {
                    $score += 10;
                }

                return [
                    'target_type' => 'invoice',
                    'target_id' => $invoice->id,
                    'target_public_id' => $invoice->public_id,
                    'label' => $invoice->invoice_number,
                    'score' => min(100, $score),
                    'reason' => 'Betrag passt'.($score >= 100 ? ' und Rechnungsnummer gefunden' : ''),
                ];
            })
            ->filter(fn (array $suggestion) => $suggestion['score'] >= 80);
    }

    private function belegSuggestions(BankTransaction $transaction): Collection
    {
        if ($transaction->amount >= 0) {
            return collect();
        }

        return Beleg::where('tenant_id', $transaction->tenant_id)
            ->whereIn('status', ['booked', 'paid'])
            ->whereRaw('(amount - amount_paid) = ?', [abs((int) $transaction->amount)])
            ->with('contact')
            ->get()
            ->map(function (Beleg $beleg) use ($transaction) {
                $score = 70;
                $haystack = $this->normalize(($transaction->purpose ?? '').' '.($transaction->counterparty ?? ''));

                if (str_contains($haystack, $this->normalize($beleg->document_number))) {
                    $score += 30;
                }
                if ($beleg->contact && $this->hasTokenOverlap($haystack, $this->normalize($beleg->contact->name), 2)) {
                    $score += 15;
                }
                if ($this->hasTokenOverlap($haystack, $this->normalize($beleg->title), 2)) {
                    $score += 15;
                }

                return [
                    'target_type' => 'beleg',
                    'target_id' => $beleg->id,
                    'target_public_id' => $beleg->public_id,
                    'label' => $beleg->document_number,
                    'score' => min(100, $score),
                    'reason' => 'Betrag passt'.($score >= 100 ? ' und Belegnummer gefunden' : ''),
                ];
            })
            ->filter(fn (array $suggestion) => $suggestion['score'] >= 80);
    }

    private function hasTokenOverlap(string $left, string $right, int $minMatches): bool
    {
        $leftTokens = $this->tokens($left);
        $rightTokens = $this->tokens($right);

        if (empty($leftTokens) || empty($rightTokens)) {
            return false;
        }

        return count(array_intersect($leftTokens, $rightTokens)) >= $minMatches;
    }

    private function tokens(string $value): array
    {
        $tokens = preg_split('/\s+/', $value) ?: [];

        return array_values(array_unique(array_filter($tokens, fn (string $token) => mb_strlen($token) >= 4)));
    }

    private function normalize(?string $value): string
    {
        $value = Str::lower((string) $value);
        $value = str_replace(['kd-nr', 'kd no', 'kd-no', 'kundennummer'], 'kd', $value);
        $value = str_replace(['rg-nr', 'rg no', 'rg-no', 'rechnungsnummer', 'invoice'], 'rg', $value);
        $value = preg_replace('/[^\pL\pN\/]+/u', ' ', $value) ?? $value;
        $value = preg_replace('/\s+/', ' ', $value) ?? $value;

        return trim($value);
    }
}
