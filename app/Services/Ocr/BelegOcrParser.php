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
            'invoice date',
            'datum',
            'date',
        ]);
        $dueDate = $this->extractDate($normalized, [
            'faelligkeit',
            'falligkeit',
            'zahlbar bis',
            'zahlungsziel',
            'due date of payment',
            'due date',
            'payment due',
        ]);
        $invoiceNumber = $this->extractInvoiceNumber($normalized);
        $amounts = $this->extractAmounts($normalized);
        $supplier = $this->extractSupplier($normalized);
        $currency = $this->extractCurrency($normalized);
        $taxRate = $amounts['tax_rate'] ?? $this->extractTaxRate($normalized);
        $taxNumber = $this->extractTaxNumber($normalized);
        $iban = $this->extractIban($normalized);

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
            'supplier_tax_number' => $this->field($taxNumber, $taxNumber ? 0.84 : 0.0, $taxNumber ? 'ust-id' : null),
            'supplier_iban' => $this->field($iban, $iban ? 0.72 : 0.0, $iban ? 'iban' : null),
        ];

        // Nur gegen BESTEHENDE Kontakte matchen - der Parser legt NIE selbst einen
        // Kontakt an (verhindert Müll-Kontakte aus Fehlerkennungen). Fehlt ein Treffer,
        // bleibt supplier_name/-iban/-tax_number als Vorschlag für die manuelle Auswahl.
        $contact = $this->matchContact($fields, $normalized, $taxNumber, $iban);
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
        return '\d{1,2}\.\s*\d{1,2}\.\s*\d{2,4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\.\s*[[:alpha:]äöüÄÖÜß]+\s+\d{4}';
    }

    private function normalizeDate(string $value): ?string
    {
        $value = trim(preg_replace('/\s+/', ' ', $value) ?? $value);

        if (preg_match('/^(\d{1,2})[\/.]\s*(\d{1,2})[\/.]\s*(\d{2,4})$/', $value, $matches)) {
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
            '/(?:invoice\s*no\.?|invoice\s*number|invoice|receipt)\s*(?:no\.?|number)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\/\-.]{2,})/iu',
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
        $amountPattern = '(-?\d{1,3}(?:[. ]\d{3})*(?:,\d{2}|\.\d{2})|-?\d+(?:,\d{2}|\.\d{2}))';
        $result = [];

        $labelPatterns = [
            'gross' => '/(?:gesamtbetrag|rechnungsbetrag|brutto(?:betrag)?|summe(?:[ 	]+brutto)?|zu zahlen|total(?:[ 	]+amount)?(?:[ 	]+incl\.?[ 	]+vat)?)[ 	]*[:\-]?[ 	]*(?:€[ 	]*)?'.$amountPattern.'/iu',
            'net' => '/(?:netto(?:betrag)?|warenwert|total[ 	]*\(excl\.[ 	]*vat\)|subtotal[ 	]*\(excl\.[ 	]*vat\))[ 	]*[:\-]?[ 	]*(?:€[ 	]*)?'.$amountPattern.'/iu',
            'tax' => '/(?:(?:ust|mwst|umsatzsteuer|mehrwertsteuer|tax|vat)(?:[ 	]*\d{1,2}[ 	]*%)?)[ 	]*[:\-]?[ 	]*(?:€[ 	]*)?'.$amountPattern.'/iu',
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

        if (! isset($result['gross_amount']) && preg_match_all('/(?:€\s*'.$amountPattern.'|'.$amountPattern.'\s*(?:EUR|Euro|€))(?!\d)/iu', $text, $matches, PREG_SET_ORDER)) {
            $amounts = [];
            foreach ($matches as $match) {
                $value = ($match[1] ?? '') !== '' ? $match[1] : $match[2];
                $cents = $this->moneyToCents($value);
                if ($cents !== null) {
                    $amounts[] = $cents;
                }
            }

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

        if (isset($result['gross_amount'], $result['tax_rate']) && ! isset($result['net_amount'], $result['tax_amount'])) {
            $net = (int) round($result['gross_amount'] / (1 + ($result['tax_rate'] / 100)));
            $result['net_amount'] = $net;
            $result['net_confidence'] = 0.58;
            $result['net_source'] = 'brutto-mit-ust-satz';
            $result['tax_amount'] = $result['gross_amount'] - $net;
            $result['tax_confidence'] = 0.58;
            $result['tax_source'] = 'brutto-mit-ust-satz';
        }

        return $result;
    }

    private function extractTaxRate(string $text): ?int
    {
        if (preg_match('/(?:ust|mwst|umsatzsteuer|mehrwertsteuer|tax\s*rate|vat)[^\n]{0,40}\b(19|7)\s*%/iu', $text, $matches)) {
            return (int) $matches[1];
        }

        if (preg_match('/\b(19|7)\s*%\s*(?:ust|mwst|umsatzsteuer|mehrwertsteuer|tax|vat)/iu', $text, $matches)) {
            return (int) $matches[1];
        }

        if (preg_match('/\b(19|7)\s*%/u', $text, $matches)) {
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
        $candidateLines = array_slice($lines, 0, 16);

        // Rechnungs-Metadaten / reine Betragszeilen ausschließen (verhindert z.B.
        // "Kundennr.: 2" oder "Datum: …" als Lieferantennamen). Am ZEILENANFANG
        // ankern, damit z.B. "Industriestr." nicht wegen "ust" gefiltert wird.
        $metadata = '/^\s*(rechnung|rechnungs?[-\s]?nr|kunden[-\s]?nr|beleg[-\s]?nr|invoice|customer|datum|rechnungsdatum|belegdatum|f[aä]llig|due\s?date|zwischensumme|gesamtbetrag|nettobetrag|bruttobetrag|umsatzsteuer|steuernummer|ust[-\s]?id|iban|bic|vat|tel\.?[:\s]|fax|www\.|https?:)/iu';

        // 1) Zeile mit Rechtsform (GmbH, AG, …) bevorzugen.
        foreach ($candidateLines as $line) {
            if (preg_match($metadata, $line)) {
                continue;
            }
            $name = $this->cleanSupplierName($line);
            if ($this->isLikelySupplierLine($name)) {
                return $this->field($name, 0.82, 'kopfbereich');
            }
        }

        // 2) Erste namensartige Zeile ohne Metadaten.
        foreach ($candidateLines as $line) {
            if (preg_match($metadata, $line)) {
                continue;
            }
            $name = $this->cleanSupplierName($line);
            if (mb_strlen($name) >= 3 && preg_match('/[A-Za-zÄÖÜäöüß]/u', $name)) {
                return $this->field($name, 0.5, 'kopfbereich');
            }
        }

        return $this->field(null, 0.0, null);
    }

    private function isLikelySupplierLine(string $line): bool
    {
        return preg_match('/\b(GmbH|UG|AG|KG|OHG|e\.K\.|GbR|SE|Ltd\.?)\b/u', $line) === 1;
    }

    private function cleanSupplierName(string $line): string
    {
        $line = trim(preg_replace('/\s+/', ' ', $line) ?? $line);
        // Bei "Name, Straße, PLZ Ort" nur den Namensteil vor dem ersten Komma nehmen.
        $parts = preg_split('/\s*[,•|]\s*/u', $line);
        $line = trim($parts[0] ?? $line);

        if (preg_match('/^(.+?\b(?:GmbH|UG|AG|KG|OHG|e\.K\.|GbR|SE|Ltd\.?)\b)/u', $line, $matches)) {
            return trim($matches[1]);
        }

        return $line;
    }

    private function matchContact(array $fields, string $text, ?string $taxNumber = null, ?string $iban = null): ?Contact
    {
        // 1) USt-IdNr.
        $taxNumber ??= $this->extractTaxNumber($text);
        if ($taxNumber) {
            $contact = Contact::query()->where('tax_number', $taxNumber)->first();
            if ($contact) {
                return $contact;
            }
        }

        // 2) IBAN
        $iban ??= $this->extractIban($text);
        if ($iban) {
            foreach (Contact::query()->whereNotNull('bank_account')->get() as $contact) {
                if ($this->normalizeIban((string) $contact->bank_account) === $iban) {
                    return $contact;
                }
            }
        }

        // 3) Direkter Namenstreffer: taucht ein bestehender Kontaktname irgendwo im
        //    Belegtext auf (z.B. in der Zahlungs-/Fußzeile)? Längster Treffer gewinnt.
        $haystack = mb_strtolower($text);
        $byName = null;
        $byNameLen = 0;
        foreach (Contact::query()->get() as $contact) {
            $name = trim((string) $contact->name);
            if (mb_strlen($name) < 4) {
                continue;
            }
            if (str_contains($haystack, mb_strtolower($name)) && mb_strlen($name) > $byNameLen) {
                $byName = $contact;
                $byNameLen = mb_strlen($name);
            }
        }
        if ($byName) {
            return $byName;
        }

        // 4) Fuzzy-Match gegen den extrahierten Lieferantennamen
        $supplierName = $fields['supplier_name']['value'] ?? null;
        if (! is_string($supplierName) || mb_strlen($supplierName) < 4) {
            return null;
        }

        $best = null;
        $bestScore = 0.0;
        foreach (Contact::query()->get() as $contact) {
            similar_text(mb_strtolower($supplierName), mb_strtolower((string) $contact->name), $score);
            if ($score > $bestScore) {
                $best = $contact;
                $bestScore = $score;
            }
        }

        return $bestScore >= 72.0 ? $best : null;
    }

    private function extractTaxNumber(string $text): ?string
    {
        if (preg_match('/(?:USt(?:euer)?(?:-?IdNr\.)?|VAT\s+Reg\.\s+No\.?|VAT\s+ID)\s*[:.]?\s*\b(DE[0-9]{9})\b/i', $text, $matches)) {
            return strtoupper($matches[1]);
        }

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
            'server|hosting|cloud|domain|hetzner|software|saas|website|webseite|webdesign|entwicklung|development|programmier|app\b|edv' => ['4922', 'Internet'],
            'seo|marketing|werbung|werbe|anzeige|google ads|social media|kampagne' => ['4600', 'Werbe'],
            'porto|briefmarke|versand|dhl|paket|post' => ['4910', 'Porto'],
            'hotel|reise|übernacht|uebernacht|bahn|flug|taxi|mietwagen' => ['4670', 'Reise'],
            'anwalt|rechtsanwalt|steuerberater|beratung|consulting' => ['4950', 'Beratung'],
            'buchfuehrung|buchführung|lohnabrechnung' => ['4957', 'Buchfuehrung'],
            'büro|buero|bürobedarf|schreibwaren|papier|toner|drucker' => ['4930', 'Bürobedarf'],
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
