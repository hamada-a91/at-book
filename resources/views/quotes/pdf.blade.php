<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Angebot {{$quote->quote_number}}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 11pt; color: #333; }
        .container { padding: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .header h1 { font-size: 24pt; margin-bottom: 10px; }
        .header-logo { max-height: 80px; max-width: 200px; }
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
        .company-footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 9pt; color: #666; }
        .company-footer table { border: none; margin: 0; }
        .company-footer td { border: none; padding: 2px 0; vertical-align: top; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div>
                @if($settings->logo_path)
                    <img src="{{ storage_path('app/public/' . $settings->logo_path) }}" alt="Logo" class="header-logo">
                @elseif($settings->company_name)
                    <h1>{{ $settings->company_name }}</h1>
                @endif
            </div>
            <div class="invoice-info">
                <h2 style="font-size: 20pt;">Angebot</h2>
                <div><strong>Angebotsnr.:</strong> {{ $quote->quote_number }}</div>
                <div><strong>Kundennr.:</strong> {{ $quote->contact->id }}</div>
                <div><strong>Datum:</strong> {{ $quote->quote_date->format('d.m.Y') }}</div>
                <div><strong>Gültig bis:</strong> {{ $quote->valid_until->format('d.m.Y') }}</div>
            </div>
        </div>

        <!-- Addresses -->
        <div class="addresses">
            <div class="address">
                @if($settings->company_name || $settings->street)
                    <div class="sender">{{ $settings->company_name }}{{ $settings->company_name && $settings->street ? ', ' : '' }}{{ $settings->street }}{{ $settings->zip || $settings->city ? ', ' : '' }}{{ $settings->zip }} {{ $settings->city }}</div>
                @endif
                <div class="recipient">
                    <div style="font-weight: bold;">{{ $quote->contact->name }}</div>
                    @if($quote->contact->address)
                        <div>{!! nl2br(e($quote->contact->address)) !!}</div>
                    @endif
                </div>
            </div>
            <div class="address text-right">
                @if($settings->company_name)
                    <div>{{ $settings->company_name }}</div>
                @endif
                @if($settings->street)
                    <div>{{ $settings->street }}</div>
                @endif
                @if($settings->zip || $settings->city)
                    <div>{{ $settings->zip }} {{ $settings->city }}</div>
                @endif
                @if($settings->phone)
                    <div>Tel.: {{ $settings->phone }}</div>
                @endif
                @if($settings->email)
                    <div>{{ $settings->email }}</div>
                @endif
            </div>
        </div>

        <!-- Intro -->
        @if($quote->intro_text)
            <div class="intro">
                <p>{{ $quote->intro_text }}</p>
            </div>
        @endif

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
                @foreach($quote->lines as $index => $line)
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
                <span>{{ number_format($quote->subtotal / 100, 2, ',', '.') }} €</span>
            </div>
            @php
                $taxRates = $quote->lines->groupBy('tax_rate');
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
                <span>{{ number_format($quote->total / 100, 2, ',', '.') }} €</span>
            </div>
        </div>
        <div style="clear: both;"></div>

        <!-- Footer Text -->
        @if($quote->payment_terms || $quote->footer_note)
            <div class="footer-text">
                @if($quote->payment_terms)
                    <p><strong>{{ $quote->payment_terms }}</strong></p>
                @endif
                @if($quote->footer_note)
                    <p>{{ $quote->footer_note }}</p>
                @endif
            </div>
        @endif

        <!-- Company Footer -->
        <div class="company-footer">
            <table width="100%">
                <tr>
                    <td width="33%">
                        @if($settings->company_name)
                            <div><strong>{{ $settings->company_name }}</strong></div>
                        @endif
                        @if($settings->street)
                            <div>{{ $settings->street }}</div>
                        @endif
                        @if($settings->zip || $settings->city)
                            <div>{{ $settings->zip }} {{ $settings->city }}</div>
                        @endif
                    </td>
                    <td width="34%" class="text-center">
                        @if($settings->tax_number)
                            <div>Steuernummer: {{ $settings->tax_number }}</div>
                        @endif
                    </td>
                    <td width="33%" class="text-right">
                        @if($settings->email)
                            <div>{{ $settings->email }}</div>
                        @endif
                        @if($settings->phone)
                            <div>Tel.: {{ $settings->phone }}</div>
                        @endif
                    </td>
                </tr>
            </table>
        </div>
    </div>
</body>
</html>
