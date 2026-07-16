<?php

namespace Tests\Unit;

use App\Models\Tenant;
use App\Modules\Accounting\Models\Account;
use App\Rules\TenantExists;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * SPEC-03, Akzeptanzkriterium 1: Unit-Test für die zentrale Rule TenantExists.
 *
 * Läuft mit voller DB-Anbindung (RefreshDatabase), da die Rule direkt gegen
 * DB::table() prüft - deshalb hier via Tests\TestCase statt dem PHPUnit-
 * TestCase aus ExampleTest.php.
 */
class TenantExistsTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenantA;

    private Tenant $tenantB;

    private Account $accountOwnedByA;

    private Account $accountOwnedByB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenantA = Tenant::create(['name' => 'Tenant A GmbH', 'slug' => 'tenant-a']);
        $this->tenantB = Tenant::create(['name' => 'Tenant B GmbH', 'slug' => 'tenant-b']);

        // Konten unter dem jeweils passenden Tenant-Kontext anlegen, damit
        // BelongsToTenant::creating() die richtige tenant_id setzt.
        app()->instance('currentTenant', $this->tenantA);
        $this->accountOwnedByA = Account::create(['code' => '1200', 'name' => 'Bank A', 'type' => 'asset']);

        app()->instance('currentTenant', $this->tenantB);
        $this->accountOwnedByB = Account::create(['code' => '1200', 'name' => 'Bank B', 'type' => 'asset']);
    }

    public function test_validation_passes_for_id_owned_by_current_tenant(): void
    {
        app()->instance('currentTenant', $this->tenantA);

        $rule = new TenantExists('accounts');
        $failed = false;

        $rule->validate('account_id', $this->accountOwnedByA->id, function () use (&$failed) {
            $failed = true;
        });

        $this->assertFalse($failed, 'Eigene Tenant-ID muss die Validierung bestehen.');
    }

    public function test_validation_fails_for_id_owned_by_another_tenant(): void
    {
        app()->instance('currentTenant', $this->tenantA);

        $rule = new TenantExists('accounts');
        $failed = false;
        $message = null;

        $rule->validate('account_id', $this->accountOwnedByB->id, function ($msg) use (&$failed, &$message) {
            $failed = true;
            $message = $msg;
        });

        $this->assertTrue($failed, 'Fremde Tenant-ID darf die Validierung nicht bestehen.');
        // Fehlermeldung darf NICHT verraten, dass die ID bei einem anderen Tenant existiert.
        $this->assertStringNotContainsString('anderen Mandanten', (string) $message);
        $this->assertStringNotContainsString('anderen Tenant', (string) $message);
    }

    public function test_validation_fails_without_tenant_context(): void
    {
        app()->instance('currentTenant', null);

        $rule = new TenantExists('accounts');
        $failed = false;

        $rule->validate('account_id', $this->accountOwnedByA->id, function () use (&$failed) {
            $failed = true;
        });

        $this->assertTrue($failed, 'Ohne Mandanten-Kontext darf niemals validiert werden.');
    }

    public function test_validation_fails_for_nonexistent_id(): void
    {
        app()->instance('currentTenant', $this->tenantA);

        $rule = new TenantExists('accounts');
        $failed = false;

        $rule->validate('account_id', 999999, function () use (&$failed) {
            $failed = true;
        });

        $this->assertTrue($failed);
    }
}
