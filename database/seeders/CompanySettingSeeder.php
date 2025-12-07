<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\CompanySetting;
use App\Services\Skr03AccountPlanGenerator;
use App\Modules\Accounting\Models\Account;
use App\Models\TaxCode;

class CompanySettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('🏢 Creating Company Settings...');
        
        // 1. Create Company Setting mit Demo-Daten
        $setting = CompanySetting::create([
            'company_name' => 'Demo Firma GmbH',
            'street' => 'Musterstraße 123',
            'zip' => '10115',
            'city' => 'Berlin',
            'country' => 'Deutschland',
            'email' => 'info@demo-firma.de',
            'phone' => '+49 30 12345678',
            'tax_number' => 'DE123456789',
            'tax_type' => 'umsatzsteuer_pflichtig',
            'business_models' => json_encode(['dienstleistungen', 'handel']),
            'legal_form' => 'gmbh',
            'account_plan_initialized_at' => now(),
            'onboarding_completed' => true,
        ]);
        
        $this->command->info('✅ Company Settings created');
        
        // 2. Generate SKR03 Account Plan
        $this->command->info('📊 Generating SKR03 Account Plan...');
        
        $generator = new Skr03AccountPlanGenerator();
        $accountsData = $generator->generateAccounts(['dienstleistungen', 'handel'], 'gmbh');
        
        $createdCount = 0;
        foreach ($accountsData as $accountData) {
            if (!Account::where('code', $accountData['code'])->exists()) {
                Account::create($accountData);
                $createdCount++;
            }
        }
        
        $this->command->info("✅ Created {$createdCount} accounts");
        
        // 3. Generate Tax Codes
        $this->command->info('💰 Generating Tax Codes...');
        
        $taxCodesData = $generator->generateTaxCodes();
        $taxCodeCount = 0;
        
        foreach ($taxCodesData as $taxData) {
            if (TaxCode::where('code', $taxData['code'])->exists()) {
                continue;
            }
            
            // Find related account
            $accountId = null;
            if ($taxData['code'] === 'UST19') {
                $accountId = Account::where('code', '1776')->first()?->id;
            } elseif ($taxData['code'] === 'UST7') {
                $accountId = Account::where('code', '1771')->first()?->id;
            } elseif ($taxData['code'] === 'VST19') {
                $accountId = Account::where('code', '1576')->first()?->id;
            } elseif ($taxData['code'] === 'VST7') {
                $accountId = Account::where('code', '1571')->first()?->id;
            }
            
            $taxData['account_id'] = $accountId;
            TaxCode::create($taxData);
            $taxCodeCount++;
        }
        
        $this->command->info("✅ Created {$taxCodeCount} tax codes");
        
        $this->command->info('');
        $this->command->info('🎉 Setup complete! You can now access the dashboard.');
        $this->command->warn('📝 Demo credentials:');
        $this->command->line('   Company: Demo Firma GmbH');
        $this->command->line('   Location: Berlin');
        $this->command->line('   Account Plan: SKR03 (Dienstleistungen + Handel + GmbH)');
    }
}
