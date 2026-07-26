@php
    // SPEC-08 (Teil B): Projektkosten-Nachweis für den Kunden. Bewusst NUR Kosten
    // (expense) mit Netto/USt/Brutto - KEINE Erlöse, Margen oder Kontonummern.
    $fmt = fn ($cents) => number_format(((int) $cents) / 100, 2, ',', '.') . ' €';
    $period = trim(($report['from'] ? \Carbon\Carbon::parse($report['from'])->format('d.m.Y') : '')
        . ' – ' . ($report['to'] ? \Carbon\Carbon::parse($report['to'])->format('d.m.Y') : ''), ' –');
@endphp
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Kosten-Nachweis {{ $project->number }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 11pt; color: #333; }
        .container { padding: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .header-logo { max-height: 80px; max-width: 200px; }
        .doc-info { text-align: right; }
        .doc-info div { margin-bottom: 5px; }
        .addresses { margin-bottom: 30px; }
        .sender { font-size: 8pt; color: #666; margin-bottom: 10px; }
        .recipient { font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 15px; width: 48%; }
        .intro { margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { text-align: left; padding: 8px; border-bottom: 2px solid #000; font-size: 10pt; }
        td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 10pt; }
        .text-right { text-align: right; }
        tfoot td { border-top: 2px solid #000; border-bottom: none; font-weight: bold; padding-top: 10px; }
        .storno { color: #999; }
        .company-footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 9pt; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                @if($settings && $settings->logo_path)
                    <img src="{{ storage_path('app/public/' . $settings->logo_path) }}" alt="Logo" class="header-logo">
                @elseif($settings && $settings->company_name)
                    <h1 style="font-size: 22pt;">{{ $settings->company_name }}</h1>
                @endif
            </div>
            <div class="doc-info">
                <h2 style="font-size: 20pt;">Kosten-Nachweis</h2>
                <div><strong>Projekt-Nr.:</strong> {{ $project->number }}</div>
                <div><strong>Projekt:</strong> {{ $project->name }}</div>
                @if($period)
                    <div><strong>Zeitraum:</strong> {{ $period }}</div>
                @endif
                <div><strong>Erstellt:</strong> {{ now()->format('d.m.Y') }}</div>
            </div>
        </div>

        <div class="addresses">
            @if($settings && ($settings->company_name || $settings->street))
                <div class="sender">{{ $settings->company_name }}{{ $settings->company_name && $settings->street ? ', ' : '' }}{{ $settings->street }}{{ ($settings->zip || $settings->city) ? ', ' : '' }}{{ $settings->zip }} {{ $settings->city }}</div>
            @endif
            @if($customer)
                <div class="recipient">
                    {{ $customer->name }}<br>
                    {!! nl2br(e($customer->address)) !!}
                </div>
            @endif
        </div>

        <div class="intro">
            Nachfolgend die im o.g. Zeitraum für dieses Projekt angefallenen Kosten.
        </div>

        <table>
            <thead>
                <tr>
                    <th>Datum</th>
                    <th>Beleg</th>
                    <th>Beschreibung</th>
                    <th class="text-right">Netto</th>
                    <th class="text-right">USt</th>
                    <th class="text-right">Brutto</th>
                </tr>
            </thead>
            <tbody>
                @forelse($report['lines'] as $line)
                    <tr class="{{ $line['status'] === 'cancelled' ? 'storno' : '' }}">
                        <td>{{ \Carbon\Carbon::parse($line['booking_date'])->format('d.m.Y') }}</td>
                        <td>{{ $line['document_number'] ?? '–' }}</td>
                        <td>{{ $line['description'] }}@if($line['status'] === 'cancelled') <em>(storniert)</em>@endif</td>
                        <td class="text-right">{{ $fmt($line['netto']) }}</td>
                        <td class="text-right">{{ $fmt($line['ust']) }}</td>
                        <td class="text-right">{{ $fmt($line['brutto']) }}</td>
                    </tr>
                @empty
                    <tr><td colspan="6" class="text-center">Keine Kosten im gewählten Zeitraum.</td></tr>
                @endforelse
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3">Summe</td>
                    <td class="text-right">{{ $fmt($report['totals']['netto']) }}</td>
                    <td class="text-right">{{ $fmt($report['totals']['ust']) }}</td>
                    <td class="text-right">{{ $fmt($report['totals']['brutto']) }}</td>
                </tr>
            </tfoot>
        </table>

        @if($settings && $settings->company_name)
            <div class="company-footer">
                {{ $settings->company_name }}@if($settings->tax_number) · USt-IdNr./Steuernr.: {{ $settings->tax_number }}@endif
            </div>
        @endif
    </div>
</body>
</html>
