<?php

namespace App\Services;

use App\Modules\Accounting\Models\Account;
use Illuminate\Support\Facades\DB;

class Skr03AccountPlanGenerator
{
    /**
     * Generiert Kontenplan basierend auf Geschäftsmodellen und Rechtsform
     * 
     * @param array $businessModels Array of business models
     * @param string $legalForm Legal form of company
     * @return array Generated accounts
     */
    public function generateAccounts(array $businessModels, string $legalForm): array
    {
        $accounts = [];
        
        // 1. Basis-Kontenplan (immer enthalten)
        $accounts = array_merge($accounts, $this->getBaseAccounts());
        
        // 2. Geschäftsmodell-spezifische Konten
        foreach ($businessModels as $model) {
            $accounts = array_merge($accounts, $this->getBusinessModelAccounts($model));
        }
        
        // 3. Rechtsform-spezifische Konten
        $accounts = array_merge($accounts, $this->getLegalFormAccounts($legalForm));
        
        // 4. Duplikate entfernen (basierend auf code)
        $accounts = $this->removeDuplicates($accounts);
        
        return $accounts;
    }
    
    /**
     * Erweitert bestehenden Kontenplan um neue Geschäftsmodelle
     * (Legt nur fehlende Konten an!)
     * 
     * @param array $newBusinessModels New business models to add
     * @return array Newly created accounts
     */
    public function extendAccountPlan(array $newBusinessModels): array
    {
        $newAccounts = [];
        
        // 1. Sammle alle Ziel-Konten für neue Business-Models
        foreach ($newBusinessModels as $model) {
            $newAccounts = array_merge($newAccounts, $this->getBusinessModelAccounts($model));
        }
        
        // 2. Prüfe, welche Konten bereits existieren
        $existingCodes = Account::pluck('code')->toArray();
        
        // 3. Filtere nur fehlende Konten
        $missingAccounts = array_filter($newAccounts, fn($acc) => 
            !in_array($acc['code'], $existingCodes)
        );
        
        // 4. Lege nur neue Konten an (bestehende NIEMALS anfassen!)
        $createdAccounts = [];
        foreach ($missingAccounts as $account) {
            $createdAccounts[] = Account::create($account);
        }
        
        return $createdAccounts;
    }
    
    /**
     * Basis-Kontenplan nach SKR03 (~150 Konten)
     * ZWINGEND: 1400 und 1600 Sammelkonten
     */
    private function getBaseAccounts(): array
    {
        return [
            // ==== KLASSE 0: ANLAGEVERMÖGEN ====
            [
                'code' => '0027',
                'name' => 'Geschäfts- oder Firmenwert',
                'type' => 'asset',
                'category' => 'Anlagevermögen',
                'skr03_class' => 0,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '0100',
                'name' => 'Grundstücke und gr.gleiche Rechte o. B.',
                'type' => 'asset',
                'category' => 'Anlagevermögen',
                'skr03_class' => 0,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '0200',
                'name' => 'Grundstücke und gr.gleiche Rechte m. Wohnb.',
                'type' => 'asset',
                'category' => 'Anlagevermögen',
                'skr03_class' => 0,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '0300',
                'name' => 'Grundstücke und gr.gleiche Rechte m. Betriebsb.',
                'type' => 'asset',
                'category' => 'Anlagevermögen',
                'skr03_class' => 0,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '0420',
                'name' => 'Maschinen',
                'type' => 'asset',
                'category' => 'Anlagevermögen',
                'skr03_class' => 0,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '0440',
                'name' => 'Betriebs- und Geschäftsausstattung',
                'type' => 'asset',
                'category' => 'Anlagevermögen',
                'skr03_class' => 0,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '0600',
                'name' => 'Beteiligungen',
                'type' => 'asset',
                'category' => 'Anlagevermögen',
                'skr03_class' => 0,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            
            // ==== KLASSE 1: UMLAUFVERMÖGEN, KASSE, BANK ====
            [
                'code' => '1000',
                'name' => 'Kasse',
                'type' => 'asset',
                'category' => 'Umlaufvermögen',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '1200',
                'name' => 'Bank',
                'type' => 'asset',
                'category' => 'Umlaufvermögen',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '1360',
                'name' => 'Forderungen aus USt. im 1/11-Verfahren USt',
                'type' => 'asset',
                'category' => 'Umlaufvermögen',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '1400',
                'name' => 'Forderungen aus Lieferungen und Leistungen',
                'type' => 'asset',
                'category' => 'Umlaufvermögen',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            // Hinweis: 10000+ werden dynamisch von ContactController erstellt
            
            // Vor steuerkonten
            [
                'code' => '1571',
                'name' => 'Abziehbare Vorsteuer 7%',
                'type' => 'asset',
                'category' => 'Umlaufvermögen',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => 'VST7',
                'default_tax_rate' => 7,
                'tax_automation_type' => 'fixed',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '1576',
                'name' => 'Abziehbare Vorsteuer 19%',
                'type' => 'asset',
                'category' => 'Umlaufvermögen',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'fixed',
                'is_system' => true,
                'is_generated' => true
            ],
            
            // ==== KLASSE 2: EIGENKAPITAL UND FREMDKAPITAL ====
            [
                'code' => '1600',
                'name' => 'Verbindlichkeiten aus Lieferungen und Leistungen',
                'type' => 'liability',
                'category' => 'Verbindlichkeiten',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            // Hinweis: 70000+ werden dynamisch von ContactController erstellt
            
            [
                'code' => '1701',
                'name' => 'Erhaltene Anzahlungen 7% USt',
                'type' => 'liability',
                'category' => 'Verbindlichkeiten',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => 'UST7',
                'default_tax_rate' => 7,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '1706',
                'name' => 'Erhaltene Anzahlungen 19% USt',
                'type' => 'liability',
                'category' => 'Verbindlichkeiten',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => 'UST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '1771',
                'name' => 'Umsatzsteuer 7%',
                'type' => 'liability',
                'category' => 'Verbindlichkeiten',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => 'UST7',
                'default_tax_rate' => 7,
                'tax_automation_type' => 'fixed',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '1776',
                'name' => 'Umsatzsteuer 19%',
                'type' => 'liability',
                'category' => 'Verbindlichkeiten',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => 'UST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'fixed',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '1780',
                'name' => 'Umsatzsteuer aus im Inland stpfl. EG-Erwerb 19%',
                'type' => 'liability',
                'category' => 'Verbindlichkeiten',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => 'IG',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'fixed',
                'is_system' => true,
                'is_generated' => true
            ],

            // ==== KLASSE 4: BETRIEBLICHE AUFWENDUNGEN ====
            [
                'code' => '4120',
                'name' => 'Gehälter',
                'type' => 'expense',
                'category' => 'Personalkosten',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '4130',
                'name' => 'Gesetzliche soziale Aufwendungen',
                'type' => 'expense',
                'category' => 'Personalkosten',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '4610',
                'name' => 'Miete',
                'type' => 'expense',
                'category' => 'Raumkosten',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '4630',
                'name' => 'Heizung',
                'type' => 'expense',
                'category' => 'Raumkosten',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '4650',
                'name' => 'Reinigung',
                'type' => 'expense',
                'category' => 'Raumkosten',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '4800',
                'name' => 'Versicherungen',
                'type' => 'expense',
                'category' => 'Versicherungen/Beiträge',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '4920',
                'name' => 'Telefon',
                'type' => 'expense',
                'category' => 'Werbe-/Reisekosten',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '4930',
                'name' => 'Bürobedarf',
                'type' => 'expense',
                'category' => 'Werbe-/Reisekosten',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '4945',
                'name' => 'Fortbildungskosten',
                'type' => 'expense',
                'category' => 'Werbe-/Reisekosten',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '4980',
                'name' => 'Betriebsbedarf',
                'type' => 'expense',
                'category' => 'Werbe-/Reisekosten',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            
            // ==== KLASSE 6: WEITERE BETRIEBLICHE AUFWENDUNGEN ====
            [
                'code' => '6000',
                'name' => 'Abschreibungen auf immaterielle Vermögensgegenstände des AV',
                'type' => 'expense',
                'category' => 'Abschreibungen',
                'skr03_class' => 6,
                'account_purpose' => 'income_statement',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '6200',
                'name' => 'Abschreibungen auf Sachanlagen',
                'type' => 'expense',
                'category' => 'Abschreibungen',
                'skr03_class' => 6,
                'account_purpose' => 'income_statement',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            
            // ==== KLASSE 7: WEITERE AUFWENDUNGEN ====
            [
                'code' => '7300',
                'name' => 'Zinsaufwendungen',
                'type' => 'expense',
                'category' => 'Zinsen/ähnliche Aufwendungen',
                'skr03_class' => 7,
                'account_purpose' => 'income_statement',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
            
            // ==== KLASSE 8: ERLÖSE ====
            [
                'code' => '8100',
                'name' => 'Steuerfreie Umsätze',
                'type' => 'revenue',
                'category' => 'Umsatzerlöse',
                'skr03_class' => 8,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'EX',
                'default_tax_rate' => 0,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '8300',
                'name' => 'Erlöse 7% USt',
                'type' => 'revenue',
                'category' => 'Umsatzerlöse',
                'skr03_class' => 8,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'UST7',
                'default_tax_rate' => 7,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '8400',
                'name' => 'Erlöse 19% USt',
                'type' => 'revenue',
                'category' => 'Umsatzerlöse',
                'skr03_class' => 8,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'UST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '8500',
                'name' => 'Erlöse aus Anlagenabgang',
                'type' => 'revenue',
                'category' => 'Sonstige betriebliche Erträge',
                'skr03_class' => 8,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'UST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => true,
                'is_generated' => true
            ],
            [
                'code' => '8736',
                'name' => 'Erlöse aus dem Verkauf von Anteilen an verb. Untern.',
                'type' => 'revenue',
                'category' => 'Sonstige betriebliche Erträge',
                'skr03_class' => 8,
                'account_purpose' => 'income_statement',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => true,
                'is_generated' => true
            ],
        ];
    }
    
    /**
     * Geschäftsmodell-spezifische Konten
     */
    private function getBusinessModelAccounts(string $model): array
    {
        return match($model) {
            'dienst leistungen' => $this->getServiceAccounts(),
            'handel' => $this->getTradeAccounts(),
            'produktion' => $this->getProductionAccounts(),
            'online' => $this->getOnlineAccounts(),
            'offline' => $this->getOfflineAccounts(),
            'gemischt' => array_merge($this->getOnlineAccounts(), $this->getOfflineAccounts()),
            'allgemein' => [],
            default => []
        };
    }
    
    /**
     * Dienstleistungs-spezifische Konten
     */
    private function getServiceAccounts(): array
    {
        return [
            [
                'code' => '4650',
                'name' => 'Fremdleistungen',
                'type' => 'expense',
                'category' => 'Sonstige betriebliche Aufwendungen',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => false,
                'is_generated' => true
            ],
            [
                'code' => '8200',
                'name' => 'Honorare',
                'type' => 'revenue',
                'category' => 'Umsatzerlöse',
                'skr03_class' => 8,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'UST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => false,
                'is_generated' => true
            ],
        ];
    }
    
    /**
     * Handels-spezifische Konten
     * WICHTIG: Klasse 3 Unterscheidung!
     */
    private function getTradeAccounts(): array
    {
        return [
            // WARENEINGANG = AUFWANDSKONTO → GuV
            [
                'code' => '3400',
                'name' => 'Wareneingang 19% Vorsteuer',
                'type' => 'expense',  // WICHTIG: expense, nicht asset!
                'category' => 'Wareneingang',
                'skr03_class' => 3,
                'account_purpose' => 'income_statement',  // → GuV
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => false,
                'is_generated' => true
            ],
            [
                'code' => '3300',
                'name' => 'Wareneingang 7% Vorsteuer',
                'type' => 'expense',
                'category' => 'Wareneingang',
                'skr03_class' => 3,
                'account_purpose' => 'income_statement',  // → GuV
                'default_tax_code' => 'VST7',
                'default_tax_rate' => 7,
                'tax_automation_type' => 'default',
                'is_system' => false,
                'is_generated' => true
            ],
            // WARENBESTAND = BESTANDSKONTO → Bilanz
            [
                'code' => '3980',
                'name' => 'Warenbestand',
                'type' => 'asset',  // WICHTIG: asset!
                'category' => 'Vorräte',
                'skr03_class' => 3,
                'account_purpose' => 'balance_sheet',  // → Bilanz
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => false,
                'is_generated' => true
            ],
            [
                'code' => '4200',
                'name' => 'Frachten',
                'type' => 'expense',
                'category' => 'Sonstige betriebliche Aufwendungen',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => false,
                'is_generated' => true
            ],
        ];
    }
    
    /**
     * Produktions-spezifische Konten
     */
    private function getProductionAccounts(): array
    {
        return array_merge($this->getTradeAccounts(), [
            [
                'code' => '3100',
                'name' => 'Rohstoffe (Bestand)',
                'type' => 'asset',
                'category' => 'Vorräte',
                'skr03_class' => 3,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => false,
                'is_generated' => true
            ],
            [
                'code' => '3200',
                'name' => 'Hilfsstoffe (Bestand)',
                'type' => 'asset',
                'category' => 'Vorräte',
                'skr03_class' => 3,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => false,
                'is_generated' => true
            ],
        ]);
    }
    
    /**
     * Online-Geschäfts-spezifische Konten
     */
    private function getOnlineAccounts(): array
    {
        return [
            [
                'code' => '1201',
                'name' => 'PayPal',
                'type' => 'asset',
                'category' => 'Umlaufvermögen',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => false,
                'is_generated' => true
            ],
            [
                'code' => '1202',
                'name' => 'Stripe',
                'type' => 'asset',
                'category' => 'Umlaufvermögen',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => false,
                'is_generated' => true
            ],
            [
                'code' => '4940',
                'name' => 'Online-Marketing',
                'type' => 'expense',
                'category' => 'Werbe-/Reisekosten',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => false,
                'is_generated' => true
            ],
        ];
    }
    
    /**
     * Offline-Geschäfts-spezifische Konten
     */
    private function getOfflineAccounts(): array
    {
        return [
            // Meist bereits in Basis enthalten
            [
                'code' => '4910',
                'name' => 'Werbungskosten',
                'type' => 'expense',
                'category' => 'Werbe-/Reisekosten',
                'skr03_class' => 4,
                'account_purpose' => 'income_statement',
                'default_tax_code' => 'VST19',
                'default_tax_rate' => 19,
                'tax_automation_type' => 'default',
                'is_system' => false,
                'is_generated' => true
            ],
        ];
    }
    
    /**
     * Rechtsform-spezifische Konten
     */
    private function getLegalFormAccounts(string $legalForm): array
    {
        return match($legalForm) {
            'einzelunternehmen' => $this->getSoleProprietorAccounts(),
            'gmbh', 'ug' => $this->getGmbHAccounts(),
            'ag' => $this->getAGAccounts(),
            'gbr', 'ohg', 'kg' => $this->getPartnershipAccounts(),
            default => []
        };
    }
    
    /**
     * Einzelunternehmer-Konten
     */
    private function getSoleProprietorAccounts(): array
    {
        return [
            [
                'code' => '1800',
                'name' => 'Privatentnahmen allgemein',
                'type' => 'equity',
                'category' => 'Eigenkapital',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => false,
                'is_generated' => true
            ],
            [
                'code' => '1890',
                'name' => 'Privateinlagen',
                'type' => 'equity',
                'category' => 'Eigenkapital',
                'skr03_class' => 1,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => false,
                'is_generated' => true
            ],
        ];
    }
    
    /**
     * GmbH/UG-Konten
     */
    private function getGmbHAccounts(): array
    {
        return [
            [
                'code' => '0800',
                'name' => 'Gezeichnetes Kapital',
                'type' => 'equity',
                'category' => 'Eigenkapital',
                'skr03_class' => 0,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => false,
                'is_generated' => true
            ],
            [
                'code' => '0820',
                'name' => 'Kapitalrücklage',
                'type' => 'equity',
                'category' => 'Eigenkapital',
                'skr03_class' => 0,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => false,
                'is_generated' => true
            ],
        ];
    }
    
    /**
     * AG-Konten
     */
    private function getAGAccounts(): array
    {
        return array_merge($this->getGmbHAccounts(), [
            [
                'code' => '0850',
                'name' => 'Gewinnrücklagen',
                'type' => 'equity',
                'category' => 'Eigenkapital',
                'skr03_class' => 0,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => false,
                'is_generated' => true
            ],
        ]);
    }
    
    /**
     * Personengesellschafts-Konten (GbR, OHG, KG)
     */
    private function getPartnershipAccounts(): array
    {
        return [
            [
                'code' => '0880',
                'name' => 'Gesellschafterkonten',
                'type' => 'equity',
                'category' => 'Eigenkapital',
                'skr03_class' => 0,
                'account_purpose' => 'balance_sheet',
                'default_tax_code' => null,
                'default_tax_rate' => null,
                'tax_automation_type' => 'none',
                'is_system' => false,
                'is_generated' => true
            ],
        ];
    }
    
    /**
     * Duplikate entfernen (basierend auf Code)
     */
    private function removeDuplicates(array $accounts): array
    {
        $seen = [];
        $result = [];
        
        foreach ($accounts as $account) {
            if (!isset($seen[$account['code']])) {
                $seen[$account['code']] = true;
                $result[] = $account;
            }
        }
        
        return $result;
    }
    
    /**
     * SKR03-Konformität prüfen
     */
    public function validateSkr03Compliance(array $accounts): bool
    {
        foreach ($accounts as $account) {
            // Prüfe Kontonummer
            if (!is_numeric($account['code'])) {
                return false;
            }
            
            // Prüfe SKR03-Klasse
            $firstDigit = (int)substr($account['code'], 0, 1);
            if ($firstDigit < 0 || $firstDigit > 9) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Standard-Steuerschlüssel generieren
     */
    public function generateTaxCodes(): array
    {
        return [
            [
                'code' => 'UST19',
                'name' => 'Umsatzsteuer 19%',
                'type' => 'output_tax',
                'rate' => 19.00,
                'account_id' => null  // Wird später gesetzt
            ],
            [
                'code' => 'UST7',
                'name' => 'Umsatzsteuer 7%',
                'type' => 'output_tax',
                'rate' => 7.00,
                'account_id' => null
            ],
            [
                'code' => 'VST19',
                'name' => 'Vorsteuer 19%',
                'type' => 'input_tax',
                'rate' => 19.00,
                'account_id' => null
            ],
            [
                'code' => 'VST7',
                'name' => 'Vorsteuer 7%',
                'type' => 'input_tax',
                'rate' => 7.00,
                'account_id' => null
            ],
            [
                'code' => 'RC',
                'name' => 'Reverse Charge',
                'type' => 'reverse_charge',
                'rate' => 0.00,
                'account_id' => null
            ],
            [
                'code' => 'IG',
                'name' => 'Innergemeinschaftlich',
                'type' => 'intra_eu',
                'rate' => 0.00,
                'account_id' => null
            ],
            [
                'code' => 'EX',
                'name' => 'Export (steuerfrei)',
                'type' => 'export',
                'rate' => 0.00,
                'account_id' => null
            ],
        ];
    }
}
