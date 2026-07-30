<?php

namespace Tests\Feature\Backup;

use App\Models\BankMatchingRule;
use App\Models\BankTransaction;
use App\Models\Payment;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Services\InvoiceBookingService;
use App\Services\Banking\BankReconciliationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tests\Support\BackupTestHelper;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

class BankReconciliationBackupRoundtripTest extends TestCase
{
    use RefreshDatabase;

    public function test_bank_reconciliation_entities_survive_cross_tenant_backup_roundtrip(): void
    {
        $source = TenantTestDataFactory::create('bank-backup');
        app(InvoiceBookingService::class)->bookInvoice($source->invoice);
        $invoice = $source->invoice->fresh();

        $transaction = BankTransaction::create([
            'tenant_id' => $source->tenant->id,
            'bank_account_id' => $source->bankAccount->id,
            'booking_date' => now()->toDateString(),
            'counterparty' => $source->customer->name,
            'purpose' => "Zahlung {$invoice->invoice_number}",
            'amount' => $invoice->total,
            'currency' => 'EUR',
            'fingerprint' => sha1('bank-backup-'.$source->tenant->id),
            'raw' => ['source' => 'test'],
        ]);

        app(BankReconciliationService::class)->assign($transaction, [
            'target_type' => 'invoice',
            'target_id' => $invoice->id,
        ]);

        BankMatchingRule::create([
            'tenant_id' => $source->tenant->id,
            'match_on' => 'purpose',
            'pattern' => 'google',
            'target_type' => 'category',
            'target_account_id' => $source->accountExpense->id,
        ]);

        $export = BackupTestHelper::exportToArray($source->tenant, $source->user);
        $targetTenant = Tenant::create(['name' => 'Bank Backup Target', 'slug' => 'bank-backup-target-'.uniqid()]);
        $targetUser = User::create([
            'name' => 'Bank Importer',
            'email' => 'bank-importer-'.uniqid().'@at-book.test',
            'password' => Hash::make('password'),
            'tenant_id' => $targetTenant->id,
        ]);

        app()->instance('currentTenant', $targetTenant);
        Auth::setUser($targetUser);
        BackupTestHelper::importZip($export['zip_path'], $targetTenant, $targetUser);
        app()->instance('currentTenant', $targetTenant);

        $restoredTransaction = BankTransaction::where('fingerprint', $transaction->fingerprint)->firstOrFail();
        $restoredPayment = Payment::where('bank_transaction_id', $restoredTransaction->id)->firstOrFail();
        $restoredRule = BankMatchingRule::where('pattern', 'google')->firstOrFail();

        $this->assertSame($targetTenant->id, $restoredTransaction->tenant_id);
        $this->assertSame('matched', $restoredTransaction->status);
        $this->assertSame('invoice', $restoredTransaction->matched_type);
        $this->assertNotNull($restoredTransaction->matched_id);
        $this->assertSame($restoredTransaction->id, $restoredPayment->bank_transaction_id);
        $this->assertSame($source->accountExpense->code, $restoredRule->targetAccount->code);
    }
}
