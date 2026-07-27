<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Beleg;
use App\Models\Invoice;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class OpenItemsReportController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['nullable', 'in:debitor,kreditor'],
            'as_of' => ['nullable', 'date'],
            'view' => ['nullable', 'in:as_of,month,year'],
            'year' => ['nullable', 'integer', 'between:2000,2100'],
            'month' => ['nullable', 'integer', 'between:1,12'],
        ]);
        $view = $validated['view'] ?? 'as_of';
        $year = (int) ($validated['year'] ?? now()->year);
        $month = (int) ($validated['month'] ?? now()->month);
        $asOf = match ($view) {
            'month' => Carbon::create($year, $month, 1)->endOfMonth()->endOfDay(),
            'year' => Carbon::create($year, 12, 31)->endOfDay(),
            default => Carbon::parse($validated['as_of'] ?? now()->toDateString())->endOfDay(),
        };
        $type = $validated['type'] ?? null;
        $items = collect();

        if ($type !== 'kreditor') {
            $invoices = Invoice::query()
                ->with(['contact', 'payments.reversalJournalEntry'])
                ->whereIn('status', ['booked', 'sent', 'paid'])
                ->whereDate('invoice_date', '<=', $asOf->toDateString())
                ->get();

            $items = $items->concat($invoices->map(
                fn (Invoice $invoice) => $this->item($invoice, 'debitor', $asOf)
            )->filter());
        }

        $belege = Beleg::query()
            ->with(['contact', 'payments.reversalJournalEntry'])
            ->whereNotNull('contact_id')
            ->whereIn('status', ['booked', 'paid'])
            ->whereDate('document_date', '<=', $asOf->toDateString())
            ->when($type === 'debitor', fn ($query) => $query->where('document_type', 'ausgang'))
            ->when($type === 'kreditor', fn ($query) => $query->where('document_type', '!=', 'ausgang'))
            ->get();

        $items = $items->concat($belege->map(function (Beleg $beleg) use ($asOf) {
            $itemType = $beleg->document_type === 'ausgang' ? 'debitor' : 'kreditor';

            return $this->item($beleg, $itemType, $asOf);
        })->filter())->sortBy('due_date')->values();

        return response()->json([
            'as_of' => $asOf->toDateString(),
            'view' => $view,
            'year' => $asOf->year,
            'month' => $view === 'month' ? $asOf->month : null,
            'type' => $type,
            'items' => $items,
            'totals' => [
                'debitor' => (int) $items->where('type', 'debitor')->sum('open_amount'),
                'kreditor' => (int) $items->where('type', 'kreditor')->sum('open_amount'),
                'net' => (int) $items->where('type', 'debitor')->sum('open_amount')
                    - (int) $items->where('type', 'kreditor')->sum('open_amount'),
            ],
        ]);
    }

    private function item(Model $document, string $type, Carbon $asOf): ?array
    {
        $total = (int) ($document instanceof Invoice ? $document->total : $document->amount);
        $paid = $this->paidAsOf($document->payments, $asOf);
        $open = max(0, $total - $paid);
        if ($open === 0) {
            return null;
        }

        return [
            'type' => $type,
            'document_type' => $document instanceof Invoice ? 'invoice' : 'beleg',
            'id' => $document->id,
            'public_id' => $document->public_id,
            'number' => $document instanceof Invoice ? $document->invoice_number : $document->document_number,
            'title' => $document instanceof Invoice ? 'Rechnung '.$document->invoice_number : $document->title,
            'contact_id' => $document->contact_id,
            'contact_name' => $document->contact?->name,
            'document_date' => ($document instanceof Invoice ? $document->invoice_date : $document->document_date)?->format('Y-m-d'),
            'due_date' => $document->due_date?->format('Y-m-d'),
            'total' => $total,
            'amount_paid' => $paid,
            'open_amount' => $open,
            'status' => $document->status,
        ];
    }

    private function paidAsOf(Collection $payments, Carbon $asOf): int
    {
        return (int) $payments->filter(function ($payment) use ($asOf) {
            if ($payment->payment_date->endOfDay()->gt($asOf)) {
                return false;
            }
            if (! $payment->reversal_journal_entry_id) {
                return true;
            }

            return $payment->reversalJournalEntry
                && $payment->reversalJournalEntry->booking_date->startOfDay()->gt($asOf);
        })->sum(fn ($payment) => $payment->settlement_amount);
    }
}
