<?php

namespace Tests\Feature\Backup;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Services\InvoiceBookingService;
use App\Modules\Accounting\Services\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tests\Support\BackupTestHelper;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

class PaymentBackupRoundtripTest extends TestCase
{
    use RefreshDatabase;

    public function test_payment_ledger_survives_cross_tenant_backup_roundtrip(): void
    {
        $source = TenantTestDataFactory::create('payment-backup-source');
        app(InvoiceBookingService::class)->bookInvoice($source->invoice);
        $payment = app(PaymentService::class)->recordPayment(
            $source->invoice->fresh(),
            12345,
            now()->toDateString(),
            $source->accountBank->id
        );

        $export = BackupTestHelper::exportToArray($source->tenant, $source->user);

        $targetTenant = Tenant::create([
            'name' => 'Payment Backup Target',
            'slug' => 'payment-backup-target-'.uniqid(),
        ]);
        $targetUser = User::create([
            'name' => 'Payment Importer',
            'email' => 'payment-importer-'.uniqid().'@at-book.test',
            'password' => Hash::make('password'),
            'tenant_id' => $targetTenant->id,
        ]);

        app()->instance('currentTenant', $targetTenant);
        Auth::setUser($targetUser);
        BackupTestHelper::importZip($export['zip_path'], $targetTenant, $targetUser);

        $restoredInvoice = Invoice::where('invoice_number', $source->invoice->invoice_number)->firstOrFail();
        $restoredPayment = Payment::where('payable_type', 'invoice')
            ->where('payable_id', $restoredInvoice->id)
            ->firstOrFail();

        $this->assertSame($payment->amount, $restoredPayment->amount);
        $this->assertSame(12345, $restoredInvoice->amount_paid);
        $this->assertSame($source->accountBank->code, $restoredPayment->paymentAccount->code);
        $this->assertNotNull($restoredPayment->journalEntry);
        $this->assertSame($targetTenant->id, $restoredPayment->tenant_id);
    }
}
