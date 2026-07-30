<?php

namespace App\Services\Banking;

use App\Models\BankAccount;
use App\Models\BankImportBatch;
use App\Models\BankTransaction;
use Carbon\Carbon;
use DomainException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BankCsvImportService
{
    private const MIN_DATE = '2014-01-01';

    public function preview(UploadedFile $file, BankAccount $bankAccount, array $settings = []): array
    {
        $parsed = $this->readCsv($file, $settings, 20);

        return [
            'bank_account_id' => $bankAccount->id,
            'filename' => $file->getClientOriginalName(),
            'delimiter' => $parsed['delimiter'],
            'encoding' => $parsed['encoding'],
            'headers' => $parsed['headers'],
            'rows' => $parsed['rows'],
            'total_rows' => $parsed['total_rows'],
            'mapping_suggestion' => $this->suggestMapping($parsed['headers']),
        ];
    }

    public function import(UploadedFile $file, BankAccount $bankAccount, array $settings): array
    {
        $settings = $this->normalizeSettings($settings);
        $parsed = $this->readCsv($file, $settings);
        $tenant = tenant();

        if (! $tenant) {
            throw new DomainException('Bankimport erfordert einen Mandanten-Kontext.');
        }

        return DB::transaction(function () use ($file, $bankAccount, $settings, $parsed, $tenant) {
            $batch = BankImportBatch::create([
                'tenant_id' => $tenant->id,
                'bank_account_id' => $bankAccount->id,
                'user_id' => Auth::id(),
                'filename' => $file->getClientOriginalName(),
                'settings' => $settings,
                'total_rows' => $parsed['total_rows'],
                'imported_count' => 0,
                'skipped_count' => 0,
                'skipped_rows' => [],
            ]);

            $imported = 0;
            $skipped = [];

            foreach ($parsed['rows'] as $index => $row) {
                try {
                    $transactionData = $this->transactionData($row, $settings, $bankAccount);
                } catch (DomainException $exception) {
                    $skipped[] = $this->skippedRow($index, $row, $exception->getMessage());

                    continue;
                }

                $exists = BankTransaction::where('tenant_id', $tenant->id)
                    ->where('fingerprint', $transactionData['fingerprint'])
                    ->exists();

                if ($exists) {
                    $skipped[] = $this->skippedRow($index, $row, 'Duplikat');

                    continue;
                }

                BankTransaction::create(array_merge($transactionData, [
                    'tenant_id' => $tenant->id,
                    'bank_account_id' => $bankAccount->id,
                    'import_batch_id' => $batch->id,
                    'status' => BankTransaction::STATUS_UNMATCHED,
                    'raw' => $row,
                ]));
                $imported++;
            }

            $batch->update([
                'imported_count' => $imported,
                'skipped_count' => count($skipped),
                'skipped_rows' => $skipped,
            ]);

            return [
                'batch' => $batch->fresh(),
                'imported' => $imported,
                'skipped' => count($skipped),
                'not_imported_rows' => $skipped,
            ];
        });
    }

    public function transactionData(array $row, array $settings, BankAccount $bankAccount): array
    {
        $mapping = $settings['mapping'] ?? [];
        $bookingDate = $this->parseDate($this->value($row, $mapping['booking_date'] ?? null));
        $valueDate = $this->parseDate($this->value($row, $mapping['value_date'] ?? null), false);
        $amount = $this->parseMappedAmount($row, $settings);

        if ($bookingDate->lt(Carbon::parse(self::MIN_DATE))) {
            throw new DomainException('Buchungsdatum liegt vor dem 01.01.2014');
        }

        $counterparty = $this->nullableString($this->value($row, $mapping['counterparty'] ?? null));
        $purpose = $this->nullableString($this->value($row, $mapping['purpose'] ?? null));
        $currency = $this->nullableString($this->value($row, $mapping['currency'] ?? null)) ?: $bankAccount->currency;
        $currency = Str::upper(Str::limit($currency, 3, ''));
        $fingerprint = $this->fingerprint($bankAccount->id, $bookingDate->toDateString(), $amount, $purpose, $counterparty);

        return [
            'booking_date' => $bookingDate->toDateString(),
            'value_date' => $valueDate?->toDateString(),
            'counterparty' => $counterparty,
            'purpose' => $purpose,
            'amount' => $amount,
            'currency' => $currency ?: 'EUR',
            'fingerprint' => $fingerprint,
        ];
    }

    public function fingerprint(int $bankAccountId, string $bookingDate, int $amount, ?string $purpose, ?string $counterparty): string
    {
        return sha1(implode('|', [
            $bankAccountId,
            $bookingDate,
            $amount,
            $this->normalizeText($purpose),
            $this->normalizeText($counterparty),
        ]));
    }

    private function readCsv(UploadedFile $file, array $settings = [], ?int $limit = null): array
    {
        $encoding = $settings['encoding'] ?? $this->detectEncoding($file);
        $content = file_get_contents($file->getRealPath());
        if ($content === false) {
            throw new DomainException('CSV-Datei konnte nicht gelesen werden.');
        }

        if ($encoding !== 'UTF-8') {
            $content = mb_convert_encoding($content, 'UTF-8', $encoding);
        }
        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);

        $delimiter = $settings['delimiter'] ?? $this->detectDelimiter($content);
        $handle = fopen('php://temp', 'r+');
        fwrite($handle, $content);
        rewind($handle);

        $headers = fgetcsv($handle, 0, $delimiter, $settings['enclosure'] ?? '"');
        if (! is_array($headers)) {
            throw new DomainException('CSV-Datei enthält keine Kopfzeile.');
        }

        $headers = array_map(fn ($header) => trim((string) $header), $headers);
        $rows = [];
        $total = 0;

        while (($values = fgetcsv($handle, 0, $delimiter, $settings['enclosure'] ?? '"')) !== false) {
            if ($values === [null] || $values === false || $this->isEmptyRow($values)) {
                continue;
            }

            $row = [];
            foreach ($headers as $index => $header) {
                $row[$header] = $values[$index] ?? null;
            }

            $total++;
            if ($limit === null || count($rows) < $limit) {
                $rows[] = $row;
            }
        }

        fclose($handle);

        return [
            'delimiter' => $delimiter,
            'encoding' => $encoding,
            'headers' => $headers,
            'rows' => $rows,
            'total_rows' => $total,
        ];
    }

    private function normalizeSettings(array $settings): array
    {
        $settings['delimiter'] ??= ',';
        $settings['encoding'] ??= 'UTF-8';
        $settings['enclosure'] ??= '"';
        $settings['sign_inverted'] = (bool) ($settings['sign_inverted'] ?? false);

        if (empty($settings['mapping']['booking_date'])) {
            throw new DomainException('Mapping für Buchungsdatum fehlt.');
        }
        if (empty($settings['mapping']['amount']) && empty($settings['mapping']['debit']) && empty($settings['mapping']['credit'])) {
            throw new DomainException('Mapping für Betrag oder Soll/Haben-Spalten fehlt.');
        }

        return $settings;
    }

    private function suggestMapping(array $headers): array
    {
        $rules = [
            'booking_date' => ['buchungstag', 'buchungsdatum', 'booking date', 'date', 'datum'],
            'value_date' => ['wertstellung', 'valuta', 'value date'],
            'counterparty' => ['auftraggeber', 'empfaenger', 'empfänger', 'beguenstigter', 'begünstigter', 'name', 'counterparty'],
            'purpose' => ['verwendungszweck', 'zweck', 'purpose', 'beschreibung', 'text'],
            'amount' => ['betrag', 'amount', 'umsatz'],
            'debit' => ['soll', 'belastung', 'abbuchung', 'debit'],
            'credit' => ['haben', 'gutschrift', 'credit'],
            'currency' => ['waehrung', 'währung', 'currency'],
        ];

        $mapping = [];
        foreach ($headers as $header) {
            $normalized = $this->normalizeText($header);
            foreach ($rules as $field => $needles) {
                if (isset($mapping[$field])) {
                    continue;
                }
                foreach ($needles as $needle) {
                    if (str_contains($normalized, $this->normalizeText($needle))) {
                        $mapping[$field] = $header;
                        break;
                    }
                }
            }
        }

        return $mapping;
    }

    private function parseMappedAmount(array $row, array $settings): int
    {
        $mapping = $settings['mapping'] ?? [];

        if (! empty($mapping['amount'])) {
            $amount = $this->parseAmount($this->value($row, $mapping['amount']));
        } else {
            $debit = $this->value($row, $mapping['debit'] ?? null);
            $credit = $this->value($row, $mapping['credit'] ?? null);
            $amount = $this->nullableString($credit) !== null
                ? $this->parseAmount($credit)
                : -1 * $this->parseAmount($debit);
        }

        return $amount * (($settings['sign_inverted'] ?? false) ? -1 : 1);
    }

    private function parseAmount(mixed $value): int
    {
        $raw = $this->nullableString($value);
        if ($raw === null) {
            throw new DomainException('Betrag fehlt.');
        }

        $negative = str_contains($raw, '-');
        $clean = trim(str_replace(["\xc2\xa0", ' ', "'", '+', 'EUR', '€'], '', $raw));
        $clean = str_replace('-', '', $clean);

        if (str_contains($clean, ',') && str_contains($clean, '.')) {
            $clean = strrpos($clean, ',') > strrpos($clean, '.')
                ? str_replace(',', '.', str_replace('.', '', $clean))
                : str_replace(',', '', $clean);
        } elseif (str_contains($clean, ',')) {
            $clean = str_replace('.', '', $clean);
            $clean = str_replace(',', '.', $clean);
        }

        if (! is_numeric($clean)) {
            throw new DomainException('Betrag ist ungültig.');
        }

        $cents = (int) round(((float) $clean) * 100);
        if ($cents === 0) {
            throw new DomainException('Nullbeträge werden nicht importiert.');
        }

        return $negative ? -1 * $cents : $cents;
    }

    private function parseDate(mixed $value, bool $required = true): ?Carbon
    {
        $raw = $this->nullableString($value);
        if ($raw === null) {
            if ($required) {
                throw new DomainException('Buchungsdatum fehlt.');
            }

            return null;
        }

        $formats = ['d.m.Y H:i:s', 'd.m.Y H:i', 'd.m.Y', 'Y-m-d', 'Y/m/d', 'd/m/Y', 'm/d/Y'];
        foreach ($formats as $format) {
            try {
                $date = Carbon::createFromFormat($format, $raw);
                if ($date !== false) {
                    return $date->startOfDay();
                }
            } catch (\Throwable) {
                // Try next format.
            }
        }

        try {
            return Carbon::parse($raw)->startOfDay();
        } catch (\Throwable) {
            throw new DomainException('Datum ist ungültig.');
        }
    }

    private function value(array $row, ?string $column): mixed
    {
        return $column ? ($row[$column] ?? null) : null;
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    private function normalizeText(?string $value): string
    {
        $value = Str::lower((string) $value);
        $value = preg_replace('/\s+/', ' ', $value) ?? $value;

        return trim($value);
    }

    private function detectEncoding(UploadedFile $file): string
    {
        $sample = file_get_contents($file->getRealPath(), false, null, 0, 4096) ?: '';

        return mb_detect_encoding($sample, ['UTF-8', 'Windows-1252', 'ISO-8859-1'], true) ?: 'UTF-8';
    }

    private function detectDelimiter(string $content): string
    {
        $firstLine = strtok($content, "\r\n") ?: '';
        $candidates = [',', ';', "\t"];
        $scores = [];

        foreach ($candidates as $candidate) {
            $scores[$candidate] = count(str_getcsv($firstLine, $candidate));
        }

        arsort($scores);

        return array_key_first($scores) ?: ',';
    }

    private function isEmptyRow(array $values): bool
    {
        foreach ($values as $value) {
            if (trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }

    private function skippedRow(int $index, array $row, string $reason): array
    {
        return [
            'row_number' => $index + 2,
            'reason' => $reason,
            'raw' => $row,
        ];
    }
}
