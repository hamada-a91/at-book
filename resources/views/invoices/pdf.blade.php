<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Rechnung {{$invoice->invoice_number}}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 11pt; color: #333; }
        .container { padding: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .header h1 { font-size: 24pt; margin-bottom: 10px; }
        .invoice-info { text-align: right; }
        .invoice-info div { margin-bottom: 5px; }
        .addresses { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .address { width: 48%; }
        .sender { font-size: 8pt; color: #666; margin-bottom: 10px; }
        .recipient { font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 15px; }
        .intro { margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { text-align: left; padding: 8px; border-bottom: 2px solid #000; }
        td { padding: 8px; border-bottom: 1px solid #ddd; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .totals { float: right; width: 300px; }
        .totals div { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .totals .total { font-weight: bold; border-top: 2px solid #000; padding-top: 8px; font-size: 12pt; }
        .footer-text { margin-top: 40px; }
        .company-footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 9pt; color: #666; display: flex; justify-content: space-between; }
        .company-footer div { width: 33%; }
        .company-footer .text-center { text-align: center; }
        .company-footer .text-right { text-align: right; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div>
                <h1>{{ $settings->company_name ?? 'Vorpoint' }}</h1>
            </div>
            <div class="invoice-info">
                <h2 style="font-size: 20pt;">Rechnung</h2>
                <div><strong>Rechnungsnr.:</strong> {{ $invoice->invoice_number }}</div>
                <div><strong>Kundennr.:</strong> {{ $invoice->contact->id }}</div>
                <div><strong>Datum:</strong> {{ $invoice->invoice_date->format('d.m.Y') }}</div>
                <div><strong>Lieferdatum:</strong> {{ $invoice->due_date->format('d.m.Y') }}</div>
            </div>
        </div>

        <!-- Addresses -->
        <div class="addresses">
            <div class="address">
                <div class="sender">{{ $settings->company_name ?? 'Vorpoint' }}, {{ $settings->address ?? 'Gorkistraße 84, 04347 Leipzig' }}</div>
                <div class="recipient">
                    <div style="font-weight: bold;">{{ $invoice->contact->name }}</div>
                    @if($invoice->contact->address)
                        <div>{!! nl2br(e($invoice->contact->address)) !!}</div>
                    @endif
                </div>
            </div>
            <div class="address text-right">
                <div>{{ $settings->company_name ?? 'Vorpoint' }}</div>
                <div>{{ $settings->address ?? 'Gorkistraße 84, 04347 Leipzig' }}</div>
                <div>Tel.: {{ $settings->phone ?? '01608304048' }}</div>
                <div>{{ $settings->email ?? 'ahmed.tahhan@web.de' }}</div>
            </div>
        </div>

        <!-- Intro -->
        <div class="intro">
            <p>{{ $invoice->intro_text }}</p>
        </div>

        <!-- Table -->
        <table>
            <thead>
                <tr>
                    <th>Pos.</th>
                    <th>Bezeichnung</th>
                    <th class="text-right">Menge</th>
                    <th class="text-center">Einheit</th>
                    <th class="text-right">Einzel €</th>
                    <th class="text-right">Gesamt €</th>
                </tr>
            </thead>
            <tbody>
                @foreach($invoice->lines as $index => $line)
                    <tr>
                        <td>{{ $index + 1 }}</td>
                        <td>
                            <strong>{{ $line->description }}</strong>
                        </td>
                        <td class="text-right">{{ number_format($line->quantity, 2, ',', '.') }}</td>
                        <td class="text-center">{{ $line->unit }}</td>
                        <td class="text-right">{{ number_format($line->unit_price / 100, 2, ',', '.') }}</td>
                        <td class="text-right">{{ number_format($line->line_total / 100, 2, ',', '.') }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <!-- Totals -->
        <div class="totals">
            <div>
                <span>Zwischensumme (netto)</span>
                <span>{{ number_format($invoice->subtotal / 100, 2, ',', '.') }} €</span>
            </div>
            @php
                $taxRates = $invoice->lines->groupBy('tax_rate');
            @endphp
            @foreach($taxRates as $taxRate => $lines)
                @if($taxRate > 0)
                    @php
                        $taxAmount = $lines->sum(function($line) {
                            return round($line->line_total * ($line->tax_rate / 100));
                        });
                    @endphp
                    <div>
                        <span>Umsatzsteuer {{ number_format($taxRate, 0) }}%</span>
                        <span>{{ number_format($taxAmount / 100, 2, ',', '.') }} €</span>
                    </div>
                @endif
            @endforeach
            <div class="total">
                <span>Gesamtbetrag</span>
                <span>{{ number_format($invoice->total / 100, 2, ',', '.') }} €</span>
            </div>
        </div>
        <div style="clear: both;"></div>

        <!-- Footer Text -->
        <div class="footer-text">
            <p><strong>{{ $invoice->payment_terms }}</strong></p>
            <p>{{ $invoice->footer_note }}</p>
        </div>

        <!-- Company Footer -->
        <div class="company-footer">
            <div>
                <div><strong>{{ $settings->company_name ?? 'Vorpoint' }}</strong></div>
                <div>{{ $settings->address ?? 'Gorkistraße 84, 04347 Leipzig' }}</div>
            </div>
            <div class="text-center">
                <div>Steuernummer: {{ $settings->tax_number ?? '333333333333' }}</div>
            </div>
            <div class="text-right">
                <div>{{ $settings->email ?? 'ahmed.tahhan@web.de' }}</div>
                <div>Tel.: {{ $settings->phone ?? '01608304048' }}</div>
            </div>
        </div>
    </div>
</body>
</html>
