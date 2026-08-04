<?php

namespace App\Services\Ocr;

use App\Modules\Accounting\Models\Account;
use App\Modules\Contacts\Models\Contact;
use Carbon\CarbonImmutable;

class BelegOcrParser
{
    private const MONTHS = [
        'januar' => 1,
        'jan' => 1,
        'februar' => 2,
        'feb' => 2,
        'maerz' => 3,
        'marz' => 3,
        'maer' => 3,
        'märz' => 3,
        'mär' => 3,
        'april' => 4,
        'apr' => 4,
        'mai' => 5,
        'juni' => 6,
        'jun' => 6,
        'juli' => 7,
        'jul' => 7,
        'august' => 8,
        'aug' => 8,
        'september' => 9,
        'sep' => 9,
        'oktober' => 10,
        'okt' => 10,
        'november' => 11,
        'nov' => 11,
        'dezember' => 12,
        'dez' => 12,
    ];

    public function parse(string $text): array
    {
        $normalized = $this->normalizeText($text);

        $documentDate = $this->extractDate($normalized, [
            'rechnungsdatum',
            'belegdatum',
            'datum',
        ]);
        $dueDate = $this->extractDate($normalized, [
            'faelligkeit',
            'falligkeit',
            'zahlbar bis',
            'zahlungsziel',
        ]);
        $invoiceNumber = $this->extractInvoiceNumber($normalized);
        $amounts = $this->extractAmounts($normalized);
        $supplier = $this->extractSupplier($normalized);
        $currency = $this->extractCurrency($normalized);
        $taxRate = $amounts['tax_rate'] ?? $this->extractTaxRate($normalized);

        $fields = [
            'document_date' => $documentDate,
            'invoice_number' => $invoiceNumber,
            'due_date' => $dueDate,
            'gross_amount' => $this->field($amounts['gross_amount'] ?? null, $amounts['gross_confidence'] ?? 0.0, $amounts['gross_source'] ?? null),
            'net_amount' => $this->field($amounts['net_amount'] ?? null, $amounts['net_confidence'] ?? 0.0, $amounts['net_source'] ?? null),
            'tax_amount' => $this->field($amounts['tax_amount'] ?? null, $amounts['tax_confidence'] ?? 0.0, $amounts['tax_source'] ?? null),
            'tax_rate' => $this->field($taxRate, $taxRate !== null ? 0.82 : 0.0, $taxRate !== null ? 'ust-satz' : null),
            'currency' => $this->field($currency, 0.75, 'waehrung'),
            'supplier_name' => $supplier,
        ];

        $contact = $this->matchContact($fields, $normalized);
        if ($contact) {
            $fields['contact_id'] = $this->field($contact->id, 0.9, 'tenant-kontakt-match');
            $fields['contact_public_id'] = $this->field($contact->public_id, 0.9, 'tenant-kontakt-match');
        }

        $account = $this->suggestExpenseAccount($normalized);
        if ($account) {
            $fields['category_account_id'] = $this->field($account->id, 0.62, 'stichwort-heuristik');
            $fields['category_account_public_id'] = $this->field($account->public_id, 0.62, 'stichwort-heuristik');
        }

        return [
            'fields' => $fields,
            'confidence' => $this->overallConfidence($fields),
        ];
    }

    public function moneyToCents(string $value): ?int
    {
        $value = trim(str_replace(["\xc2\xa0", ' '], '', $value));
        $value = preg_replace('/[^\d,.\-]/', '', $value) ?? '';

        if ($value === '') {
            return null;
        }

        if (str_contains($value, ',') && str_contains($value, '.')) {
            $value = str_replace('.', '', $value);
            $value = str_replace(',', '.', $value);
        } elseif (str_contains($value, ',')) {
            $value = str_replace(',', '.', $value);
        }

        if (! is_numeric($value)) {
            return null;
        }

        return (int) round(((float) $value) * 100);
    }

    private function normalizeText(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;

        return trim($text);
    }

    private function extractDate(string $text, array $labels): array
    {
        foreach ($labels as $label) {
            $pattern = '/'.preg_quote($label, '/').'\s*[:\-]?\s*('.$this->datePattern().')/iu';
            if (preg_match($pattern, $text, $matches)) {
                return $this->field($this->normalizeDate($matches[1]), 0.86, trim($matches[0]));
            }
        }

        if (preg_match('/\b('.$this->datePattern().')\b/iu', $text, $matches)) {
            return $this->field($this->normalizeDate($matches[1]), 0.5, $matches[0]);
        }

        return $this->field(null, 0.0, null);
    }

    private function datePattern(): string
    {
        return '\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4}|\d{1,2}\.\s*[[:alpha:]äöüÄÖÜß]+\s+\d{4}';
    }

    private function normalizeDate(string $value): ?string
    {
        $value = trim(preg_replace('/\s+/', ' ', $value) ?? $value);

        if (preg_match('/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})$/', $value, $matches)) {
            $year = (int) $matches[3];
            if ($year < 100) {
                $year += 2000;
            }

            try {
                return CarbonImmutable::createSafe($year, (int) $matches[2], (int) $matches[1])?->toDateString();
            } catch (\Throwable) {
                return null;
            }
        }

        if (preg_match('/^(\d{1,2})\.\s*([[:alpha:]äöüÄÖÜß]+)\s+(\d{4})$/u', $value, $matches)) {
            $monthKey = mb_strtolower($this->transliterateGermanMonth($matches[2]));
            $month = self::MONTHS[$monthKey] ?? self::MONTHS[mb_strtolower($matches[2])] ?? null;

            if ($month) {
                try {
                    return CarbonImmutable::createSafe((int) $matches[3], $month, (int) $matches[1])?->toDateString();
                } catch (\Throwable) {
                    return null;
                }
            }
        }

        return null;
    }

    private function transliterateGermanMonth(string $value): string
    {
        return strtr($value, ['ä' => 'ae', 'Ä' => 'ae', 'ö' => 'oe', 'Ö' => 'oe', 'ü' => 'ue', 'Ü' => 'ue']);
    }

    private function extractInvoiceNumber(string $text): array
    {
        $patterns = [
            '/(?:rechnung(?:s)?(?:\s*[- ]?\s*nr\.?|nummer)|beleg(?:\s*[- ]?\s*nr\.?|nummer)|rg(?:\s*[- ]?\s*nr\.?))\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\/\-.]{2,})/iu',
            '/(?:invoice|receipt)\s*(?:no\.?|number)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\/\-.]{2,})/iu',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                return $this->field(trim($matches[1], " .\t\n\r\0\x0B"), 0.88, trim($matches[0]));
            }
        }

        return $this->field(null, 0.0, null);
    }

    private function extractAmounts(string $text): array
    {
        $amountPattern = '(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})';
        $result = [];

        $labelPatterns = [
            'gross' => '/(?:gesamtbetrag|rechnungsbetrag|brutto(?:betrag)?|summe(?:\s+brutto)?|zu zahlen)\s*[:\-]?\s*'.$amountPattern.'/iu',
            'net' => '/(?:netto(?:betrag)?|warenwert)\s*[:\-]?\s*'.$amountPattern.'/iu',
            'tax' => '/(?:(?:ust|mwst|umsatzsteuer|mehrwertsteuer)(?:\s*\d{1,2}\s*%)?)\s*[:\-]?\s*'.$amountPattern.'/iu',
        ];

        foreach ($labelPatterns as $key => $pattern) {
            if (preg_match_all($pattern, $text, $matches, PREG_SET_ORDER)) {
                $last = end($matches);
                $cents = $this->moneyToCents($last[1]);
                if ($cents !== null) {
                    $result[$key.'_amount'] = $cents;
                    $result[$key.'_confidence'] = 0.86;
                    $result[$key.'_source'] = trim($last[0]);
                }
            }
        }

        if (! isset($result['gross_amount']) && preg_match_all('/'.$amountPattern.'\s*(?:EUR|Euro|€)/iu', $text, $matches)) {
            $amounts = array_values(array_filter(array_map(fn (string $value) => $this->moneyToCents($value), $matches[1]), fn ($value) => $value !== null));
            if ($amounts !== []) {
                $result['gross_amount'] = max($amounts);
                $result['gross_confidence'] = 0.54;
                $result['gross_source'] = 'groesster erkannter EUR-Betrag';
            }
        }

        $rate = $this->extractTaxRate($text);
        if ($rate !== null) {
            $result['tax_rate'] = $rate;
        }

        if (isset($result['gross_amount'], $result['tax_amount']) && ! isset($result['net_amount'])) {
            $result['net_amount'] = $result['gross_amount'] - $result['tax_amount'];
            $result['net_confidence'] = 0.72;
            $result['net_source'] = 'brutto-minus-ust';
        }

        if (isset($result['gross_amount'], $result['net_amount']) && ! isset($result['tax_amount'])) {
            $result['tax_amount'] = $result['gross_amount'] - $result['net_amount'];
            $result['tax_confidence'] = 0.72;
            $result['tax_source'] = 'brutto-minus-netto';
        }

        return $result;
    }

    private function extractTaxRate(string $text): ?int
    {
        if (preg_match('/(?:ust|mwst|umsatzsteuer|mehrwertsteuer)[^\n]{0,20}\b(19|7)\s*%/iu', $text, $matches)) {
            return (int) $matches[1];
        }

        if (preg_match('/\b(19|7)\s*%\s*(?:ust|mwst|umsatzsteuer|mehrwertsteuer)/iu', $text, $matches)) {
            return (int) $matches[1];
        }

        return null;
    }

    private function extractCurrency(string $text): string
    {
        if (preg_match('/\b(CHF|USD|GBP)\b/u', $text, $matches)) {
            return $matches[1];
        }

        return 'EUR';
    }

    private function extractSupplier(string $text): array
    {
        $lines = array_values(array_filter(array_map('trim', explode("\n", $text))));
        $candidateLines = array_slice($lines, 0, 12);

        foreach ($candidateLines as $line) {
            if ($this->isLikelySupplierLine($line)) {
                return $this->field($line, 0.58, 'kopfbereich');
            }
        }

        foreach ($candidateLines as $line) {
            if (mb_strlen($line) >= 4 && ! preg_match('/rechnung|beleg|datum|telefon|email|www|seite/i', $line)) {
                return $this->field($line, 0.42, 'kopfbereich');
            }
        }

        return $this->field(null, 0.0, null);
    }

    private function isLikelySupplierLine(string $line): bool
    {
        return preg_match('/\b(GmbH|UG|AG|KG|OHG|e\.K\.|GbR|SE|Ltd\.?)\b/u', $line) === 1;
    }

    private function matchContact(array $fields, string $text): ?Contact
    {
        $taxNumber = $this->extractTaxNumber($text);
        if ($taxNumber) {
            $contact = Contact::query()
                ->where('tax_number', $taxNumber)
                ->first();
            if ($contact) {
                return $contact;
            }
        }

        $iban = $this->extractIban($text);
        if ($iban) {
            $contacts = Contact::query()->whereNotNull('bank_account')->get();
            foreach ($contacts as $contact) {
                if ($this->normalizeIban((string) $contact->bank_account) === $iban) {
                    return $contact;
                }
            }
        }

        $supplierName = $fields['supplier_name']['value'] ?? null;
        if (! $supplierName) {
            return null;
        }

        $best = null;
        $bestScore = 0.0;
        foreach (Contact::query()->get() as $contact) {
            similar_text(mb_strtolower($supplierName), mb_strtolower($contact->name), $score);
            if ($score > $bestScore) {
                $best = $contact;
                $bestScore = $score;
            }
        }

        return $bestScore >= 72.0 ? $best : null;
    }

    private function extractTaxNumber(string $text): ?string
    {
        if (preg_match('/\b(DE[0-9]{9})\b/i', $text, $matches)) {
            return strtoupper($matches[1]);
        }

        return null;
    }

    private function extractIban(string $text): ?string
    {
        if (preg_match('/\bDE[0-9A-Z ]{20,32}\b/i', $text, $matches)) {
            return $this->normalizeIban($matches[0]);
        }

        return null;
    }

    private function normalizeIban(string $value): string
    {
        return strtoupper(preg_replace('/\s+/', '', $value) ?? '');
    }

    private function suggestExpenseAccount(string $text): ?Account
    {
        $keywords = [
            'telekom|telefon|internet|mobilfunk' => ['4922', 'Telekommunikation'],
            'porto|briefmarke|versand|dhl|post' => ['4910', 'Porto'],
            'hotel|reise|bahn|flug|taxi' => ['4670', 'Reise'],
            'anwalt|steuerberater|beratung' => ['4950', 'Beratung'],
            'buchfuehrung|buchführung|lohnabrechnung' => ['4957', 'Buchfuehrung'],
        ];

        foreach ($keywords as $pattern => [$code, $name]) {
            if (preg_match('/'.$pattern.'/iu', $text) !== 1) {
                continue;
            }

            return Account::query()
                ->where('type', 'expense')
                ->where(function ($query) use ($code, $name) {
                    $query->where('code', $code)
                        ->orWhere('name', 'like', '%'.$name.'%');
                })
                ->orderBy('code')
                ->first();
        }

        return null;
    }

    private function overallConfidence(array $fields): float
    {
        $values = array_filter(array_map(fn (array $field) => $field['value'] !== null ? (float) $field['confidence'] : null, $fields));

        if ($values === []) {
            return 0.0;
        }

        return round(array_sum($values) / count($values), 2);
    }

    private function field(mixed $value, float $confidence, ?string $source): array
    {
        return [
            'value' => $value,
            'confidence' => round(max(0.0, min(1.0, $confidence)), 2),
            'source' => $source,
        ];
    }
}
