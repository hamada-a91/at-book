<?php

namespace Tests\Feature\Backup;

use App\Models\Tenant;
use App\Models\User;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\ReportAccountMapping;
use App\Modules\Accounting\Reports\Bwa\BwaMappingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tests\Support\BackupTestHelper;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

class ReportAccountMappingBackupTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_account_mappings_roundtrip_and_remap_source_public_id(): void
    {
        $dataA = TenantTestDataFactory::create('bwa-backup-a');
        app(BwaMappingService::class)->ensureDefaults($dataA->tenant);
        $sourceRevenueAccount = Account::withoutGlobalScopes()
            ->where('tenant_id', $dataA->tenant->id)
            ->where('code', '8400')
            ->firstOrFail();

        $this->assertDatabaseHas('report_account_mappings', [
            'tenant_id' => $dataA->tenant->id,
            'report_type' => 'bwa',
            'source_public_id' => $sourceRevenueAccount->public_id,
            'target_code' => 'revenue',
        ]);

        $exportA = BackupTestHelper::exportToArray($dataA->tenant, $dataA->user);
        $this->assertNotEmpty($exportA['data']['report_account_mappings'] ?? []);

        $tenantB = Tenant::create(['name' => 'BWA Backup Ziel', 'slug' => 'bwa-backup-ziel']);
        $userB = User::create([
            'name' => 'Importeur',
            'email' => 'bwa-import-'.uniqid().'@at-book.test',
            'password' => Hash::make('password'),
            'tenant_id' => $tenantB->id,
        ]);

        app()->instance('currentTenant', $tenantB);
        Auth::setUser($userB);
        BackupTestHelper::importZip($exportA['zip_path'], $tenantB, $userB);

        $targetRevenueAccount = Account::withoutGlobalScopes()
            ->where('tenant_id', $tenantB->id)
            ->where('code', '8400')
            ->firstOrFail();
        $targetMapping = ReportAccountMapping::withoutGlobalScopes()
            ->where('tenant_id', $tenantB->id)
            ->where('report_type', 'bwa')
            ->where('target_code', 'revenue')
            ->where('source_public_id', $targetRevenueAccount->public_id)
            ->first();

        $this->assertNotNull($targetMapping);
        $this->assertNotSame($sourceRevenueAccount->public_id, $targetMapping->source_public_id);
    }
}
