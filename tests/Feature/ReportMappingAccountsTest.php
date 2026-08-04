<?php

namespace Tests\Feature;

use App\Modules\Accounting\Models\Account;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

class ReportMappingAccountsTest extends TestCase
{
    use RefreshDatabase;

    public function test_bwa_mappable_accounts_are_pnl_only_and_exclude_personal_accounts(): void
    {
        $data = TenantTestDataFactory::create('mapacc-bwa');
        $token = auth('api')->login($data->user);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/report-mappings/accounts?report_type=bwa');
        $response->assertOk();

        $codes = collect($response->json())->pluck('code')->all();

        // Erfolgskonten enthalten
        $this->assertContains('8400', $codes);   // Erlöse
        $this->assertContains('4930', $codes);   // Aufwand
        // Personenkonten (Debitor/Kreditor) ausgeschlossen
        $this->assertNotContains('10001', $codes);
        $this->assertNotContains('70001', $codes);
        // Bestandskonten bei der BWA ausgeschlossen
        $this->assertNotContains('1200', $codes); // Bank
        $this->assertNotContains('1776', $codes); // USt
    }

    public function test_euer_mappable_accounts_include_tax_accounts_but_exclude_personal(): void
    {
        $data = TenantTestDataFactory::create('mapacc-euer');
        $token = auth('api')->login($data->user);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/report-mappings/accounts?report_type=euer');
        $response->assertOk();

        $codes = collect($response->json())->pluck('code')->all();

        $this->assertContains('8400', $codes);   // Erlöse
        $this->assertContains('1776', $codes);   // USt-Steuerkonto - bei EÜR erlaubt
        // Personenkonten weiterhin ausgeschlossen, obwohl asset/liability
        $this->assertNotContains('10001', $codes);
        $this->assertNotContains('70001', $codes);
    }

    public function test_bwa_default_mapping_puts_office_costs_into_other_costs(): void
    {
        $data = TenantTestDataFactory::create('mapacc-default');
        app()->instance('currentTenant', $data->tenant);
        Account::withoutGlobalScopes()->firstOrCreate(
            ['tenant_id' => $data->tenant->id, 'code' => '4920'],
            ['name' => 'Telefon', 'type' => 'expense']
        );
        Account::withoutGlobalScopes()->firstOrCreate(
            ['tenant_id' => $data->tenant->id, 'code' => '4670'],
            ['name' => 'Reisekosten', 'type' => 'expense']
        );
        $token = auth('api')->login($data->user);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/report-mappings/bwa');
        $response->assertOk();

        $mappings = collect($response->json('mappings'));
        $telefon = $mappings->first(fn ($m) => ($m['source']['code'] ?? null) === '4920');
        $reise = $mappings->first(fn ($m) => ($m['source']['code'] ?? null) === '4670');

        $this->assertNotNull($telefon);
        $this->assertSame('other_costs', $telefon['target_code']);   // Telefon -> Sonstige Kosten
        $this->assertNotNull($reise);
        $this->assertSame('advertising_travel', $reise['target_code']); // Reisekosten -> Werbe-/Reisekosten
    }
}
