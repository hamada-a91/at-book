<?php

namespace Tests\Unit\Ocr;

use App\Services\Ocr\BelegOcrParser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

class BelegOcrParserTest extends TestCase
{
    use RefreshDatabase;

    public function test_parser_extracts_common_german_invoice_fields_as_integer_cents(): void
    {
        $data = TenantTestDataFactory::create('ocr-parser');
        $data->vendor->update([
            'tax_number' => 'DE123456789',
            'bank_account' => 'DE12 3456 7890 1234 5678 90',
        ]);

        $rawText = <<<'TEXT'
Buerobedarf Schmidt KG
Musterstrasse 4
10115 Berlin
USt-IdNr. DE123456789
IBAN DE12 3456 7890 1234 5678 90

Rechnung
Rechnungs-Nr: RE-2026-77
Rechnungsdatum: 15.07.2026
Faelligkeit: 30.07.2026

Nettobetrag 100,00
Umsatzsteuer 19% 19,00
Gesamtbetrag 119,00 EUR
TEXT;

        $result = app(BelegOcrParser::class)->parse($rawText);
        $fields = $result['fields'];

        $this->assertSame('2026-07-15', $fields['document_date']['value']);
        $this->assertSame('RE-2026-77', $fields['invoice_number']['value']);
        $this->assertSame('2026-07-30', $fields['due_date']['value']);
        $this->assertSame(10_000, $fields['net_amount']['value']);
        $this->assertSame(1_900, $fields['tax_amount']['value']);
        $this->assertSame(11_900, $fields['gross_amount']['value']);
        $this->assertSame(19, $fields['tax_rate']['value']);
        $this->assertSame('EUR', $fields['currency']['value']);
        $this->assertSame($data->vendor->id, $fields['contact_id']['value']);
    }

    public function test_parser_extracts_fields_but_never_auto_creates_contact(): void
    {
        $data = TenantTestDataFactory::create('ocr-hetzner');

        $rawText = <<<'TEXT'
Hetzner Online GmbH • Industriestr. 25 • 91710 Gunzenhausen • Germany

Mr. Ahmed Tahhan
Gorkistraße 84
04347 Leipzig
Germany

Tel.: +49 9831 505-0
info@hetzner.com
www.hetzner.com
Customer ID: K0866945323
Invoice no.: 086000741026
Invoice date: 09/03/2026

Invoice 086000741026

Total
Tax code

Tax rate

Total (excl. VAT)

Tax

Total

A1

19 %

€ 9.30

€ 1.77

€ 11.07

The amount will be debited from the following account.
IBAN: DE97***************383
Creditor ID: DE63ZZZ00000015422
Due date of payment: 12/03/2026
Mandate reference: 000000065077

Hetzner Online GmbH
VAT Reg. No.: DE812871812
Bank details:
Deutsche Bank AG Nuremberg
IBAN: DE92 7607 0012 0750 0077 00
TEXT;

        $result = app(BelegOcrParser::class)->parse($rawText);
        $fields = $result['fields'];

        $this->assertSame('Hetzner Online GmbH', $fields['supplier_name']['value']);
        $this->assertSame('086000741026', $fields['invoice_number']['value']);
        $this->assertSame('2026-03-09', $fields['document_date']['value']);
        $this->assertSame('2026-03-12', $fields['due_date']['value']);
        $this->assertSame(1_107, $fields['gross_amount']['value']);
        $this->assertSame(930, $fields['net_amount']['value']);
        $this->assertSame(177, $fields['tax_amount']['value']);
        $this->assertSame(19, $fields['tax_rate']['value']);
        $this->assertSame('DE812871812', $fields['supplier_tax_number']['value']);

        // Kein bestehender Kontakt "Hetzner" -> KEIN Match und - wichtig - KEINE
        // automatische Anlage (verhindert Müll-Kontakte aus Fehlerkennungen).
        $this->assertArrayNotHasKey('contact_id', $fields);
        $this->assertDatabaseMissing('contacts', [
            'tenant_id' => $data->tenant->id,
            'name' => 'Hetzner Online GmbH',
        ]);
    }

    public function test_parser_leaves_missing_fields_empty_instead_of_guessing(): void
    {
        TenantTestDataFactory::create('ocr-empty');

        $result = app(BelegOcrParser::class)->parse('Vielen Dank fuer Ihren Einkauf.');

        $this->assertNull($result['fields']['invoice_number']['value']);
        $this->assertNull($result['fields']['gross_amount']['value']);
        $this->assertNull($result['fields']['tax_amount']['value']);
    }
}
