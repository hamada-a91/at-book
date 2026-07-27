<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RecordPaymentRequest;
use App\Models\Beleg;
use App\Models\Invoice;
use App\Models\Payment;
use App\Modules\Accounting\Services\PaymentService;
use DomainException;
use Illuminate\Http\JsonResponse;
use Throwable;

class PaymentController extends Controller
{
    public function __construct(private PaymentService $paymentService) {}

    public function indexInvoice(Invoice $invoice): JsonResponse
    {
        return response()->json($invoice->payments()->with($this->relations())->latest('payment_date')->latest('id')->get());
    }

    public function storeInvoice(RecordPaymentRequest $request, Invoice $invoice): JsonResponse
    {
        return $this->store($request, $invoice);
    }

    public function indexBeleg(Beleg $beleg): JsonResponse
    {
        return response()->json($beleg->payments()->with($this->relations())->latest('payment_date')->latest('id')->get());
    }

    public function storeBeleg(RecordPaymentRequest $request, Beleg $beleg): JsonResponse
    {
        return $this->store($request, $beleg);
    }

    public function destroy(Payment $payment): JsonResponse
    {
        try {
            $payment = $this->paymentService->reversePayment($payment);
        } catch (DomainException $exception) {
            return response()->json(['error' => $exception->getMessage()], 422);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['error' => 'Fehler beim Stornieren der Zahlung.'], 422);
        }

        return response()->json([
            'message' => 'Zahlung wurde per Generalumkehr storniert.',
            'payment' => $payment,
        ]);
    }

    private function store(RecordPaymentRequest $request, Invoice|Beleg $payable): JsonResponse
    {
        $data = $request->validated();

        try {
            $payment = $this->paymentService->recordPayment(
                $payable,
                (int) $data['amount'],
                $data['payment_date'],
                (int) $data['payment_account_id'],
                isset($data['bank_transaction_id']) ? (int) $data['bank_transaction_id'] : null,
                isset($data['discount_amount']) ? (int) $data['discount_amount'] : null,
                isset($data['discount_account_id']) ? (int) $data['discount_account_id'] : null,
                $data['note'] ?? null,
            );
        } catch (DomainException $exception) {
            return response()->json(['error' => $exception->getMessage()], 422);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['error' => 'Fehler beim Erfassen der Zahlung.'], 422);
        }

        return response()->json([
            'payment' => $payment,
            'payable' => $payable->fresh(['contact', 'payments']),
        ], 201);
    }

    private function relations(): array
    {
        return ['paymentAccount', 'discountAccount', 'journalEntry', 'reversalJournalEntry'];
    }
}
