<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Modules\Accounting\Models\Account;

class AccountSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            // Assets
            ['code' => '1000', 'name' => 'Kasse', 'type' => 'asset', 'tax_key_code' => null],
            ['code' => '1200', 'name' => 'Bank', 'type' => 'asset', 'tax_key_code' => null],
            ['code' => '1400', 'name' => 'Forderungen a.LL.', 'type' => 'asset', 'tax_key_code' => null],
            
            // Liabilities
            ['code' => '1600', 'name' => 'Verbindlichkeiten a.LL.', 'type' => 'liability', 'tax_key_code' => null],
            ['code' => '1776', 'name' => 'Umsatzsteuer 19%', 'type' => 'liability', 'tax_key_code' => null],
            ['code' => '1771', 'name' => 'Umsatzsteuer 7%', 'type' => 'liability', 'tax_key_code' => null],
            ['code' => '1576', 'name' => 'Vorsteuer 19%', 'type' => 'asset', 'tax_key_code' => null],
            ['code' => '1571', 'name' => 'Vorsteuer 7%', 'type' => 'asset', 'tax_key_code' => null],

            // Revenue (Erlöse)
            ['code' => '8400', 'name' => 'Erlöse 19% USt', 'type' => 'revenue', 'tax_key_code' => 'UST_19'],
            ['code' => '8300', 'name' => 'Erlöse 7% USt', 'type' => 'revenue', 'tax_key_code' => 'UST_7'],
            ['code' => '8100', 'name' => 'Steuerfreie Umsätze', 'type' => 'revenue', 'tax_key_code' => null],

            // Expenses (Aufwand)
            ['code' => '3400', 'name' => 'Wareneingang 19%', 'type' => 'expense', 'tax_key_code' => 'VST_19'],
            ['code' => '4930', 'name' => 'Bürobedarf', 'type' => 'expense', 'tax_key_code' => 'VST_19'],
            ['code' => '4980', 'name' => 'Betriebsbedarf', 'type' => 'expense', 'tax_key_code' => 'VST_19'],
        ];

        foreach ($accounts as $acc) {
            Account::updateOrCreate(['code' => $acc['code']], $acc);
        }
    }
}
