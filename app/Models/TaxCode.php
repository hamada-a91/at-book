<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use App\Modules\Accounting\Models\Account;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaxCode extends Model
{
    use BelongsToTenant, HasPublicId;

    protected $fillable = [
        'code',
        'name',
        'type',
        'rate',
        'account_id',
    ];

    protected $casts = [
        'rate' => 'decimal:2',
    ];

    /**
     * Verknüpfung zum Steuerkonto
     */
    public function account(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Accounting\Models\Account::class);
    }

    /**
     * Löst das Umsatzsteuer-Automatikkonto für einen Steuersatz auf (SPEC-04, 4.2).
     *
     * Reihenfolge:
     * 1. Tenant-scoped tax_codes-Eintrag (type=output_tax, passender Satz) mit
     *    verknüpftem Konto - der eigentliche, konfigurierbare Weg.
     * 2. Nur als letzte Stufe: Fallback auf feste SKR03-Kontocodes (1776 für 19%,
     *    1771 für 7%) - ausschließlich zur Abwärtskompatibilität für Alt-Tenants,
     *    die ihre Steuerschlüssel noch nicht vollständig gepflegt haben.
     * 3. Nichts gefunden -> DomainException (keine stille Auslassung der USt-Zeile
     *    mehr, siehe CLAUDE.md "Bekannte Fallen": USt-Konto '1776' hartcodiert).
     *
     * @throws DomainException wenn kein Umsatzsteuerkonto konfiguriert ist
     */
    public static function resolveOutputTaxAccount(float $rate): Account
    {
        return self::resolve(
            type: 'output_tax',
            rate: $rate,
            fallbackCodes: [19 => '1776', 7 => '1771'],
            errorLabel: 'Umsatzsteuerkonto'
        );
    }

    /**
     * Löst das Vorsteuer-Automatikkonto für einen Steuersatz auf (Belege/Eingangsrechnungen).
     * Gleiches Prinzip wie resolveOutputTaxAccount(), nur für type=input_tax.
     *
     * @throws DomainException wenn kein Vorsteuerkonto konfiguriert ist
     */
    public static function resolveInputTaxAccount(float $rate): Account
    {
        return self::resolve(
            type: 'input_tax',
            rate: $rate,
            fallbackCodes: [19 => '1576', 7 => '1571'],
            errorLabel: 'Vorsteuerkonto'
        );
    }

    /**
     * @param  array<int,string>  $fallbackCodes  Steuersatz (gerundet) => Fallback-Kontocode
     *
     * @throws DomainException
     */
    private static function resolve(string $type, float $rate, array $fallbackCodes, string $errorLabel): Account
    {
        $taxCode = static::query()
            ->where('type', $type)
            ->where('rate', $rate)
            ->whereNotNull('account_id')
            ->first();

        if ($taxCode && $taxCode->account) {
            return $taxCode->account;
        }

        // Letzte Stufe: feste Fallback-Kontocodes je Standardsatz (Abwärtskompatibilität
        // für Alt-Tenants, die ihre Steuerschlüssel noch nicht vollständig gepflegt haben).
        $fallbackCode = $fallbackCodes[(int) round($rate)] ?? null;

        if ($fallbackCode) {
            $account = Account::where('code', $fallbackCode)->first();
            if ($account) {
                return $account;
            }
        }

        throw new DomainException(sprintf(
            'Kein %s für %s%% konfiguriert. Bitte in den Steuerschlüsseln ein Konto hinterlegen.',
            $errorLabel,
            self::formatRate($rate)
        ));
    }

    private static function formatRate(float $rate): string
    {
        return rtrim(rtrim(number_format($rate, 2, ',', ''), '0'), ',');
    }
}
