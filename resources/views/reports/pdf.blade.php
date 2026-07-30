<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>{{ $report['report_type'] }}</title>
    <style>
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 9pt; color: #222; }
        .header { margin-bottom: 22px; border-bottom: 2px solid #222; padding-bottom: 12px; }
        .company { font-size: 16pt; font-weight: bold; }
        .meta { margin-top: 8px; color: #555; }
        .warning { margin: 10px 0; padding: 8px; background: #fff3cd; border: 1px solid #f0d36a; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0 20px; }
        th { text-align: left; border-bottom: 2px solid #333; padding: 5px; }
        td { border-bottom: 1px solid #ddd; padding: 5px; vertical-align: top; }
        .right { text-align: right; }
        .section { font-size: 12pt; font-weight: bold; margin-top: 16px; }
        .totals { margin-top: 14px; padding-top: 8px; border-top: 1px solid #999; }
    </style>
</head>
<body>
    @php
        $money = fn ($cents) => number_format(((int) $cents) / 100, 2, ',', '.') . ' EUR';
        $title = match ($report['report_type']) {
            'trial_balance' => 'Summen- und Saldenliste',
            'profit_loss' => 'Gewinn- und Verlustrechnung',
            'balance_sheet' => 'Bilanz',
            'journal' => 'Journal',
            'account_movements' => 'Kontobewegungen',
            'vat' => 'USt-Bericht',
            default => $report['report_type'],
        };
    @endphp

    <div class="header">
        <div class="company">{{ $settings?->company_name ?? 'AT-Book' }}</div>
        <h1>{{ $title }}</h1>
        <div class="meta">
            Zeitraum: {{ $report['period']['from'] }} bis {{ $report['period']['to'] }}
            · Basis: {{ $report['basis'] }}
            · Erstellt: {{ $report['generated_at'] }}
        </div>
    </div>

    @if($report['basis'] === 'preview')
        <div class="warning">Vorschau enthält Entwürfe und ist nicht zur Abgabe geeignet.</div>
    @endif

    @if($report['report_type'] === 'trial_balance')
        <table>
            <thead><tr><th>Konto</th><th>Name</th><th class="right">Eröffnung</th><th class="right">Soll</th><th class="right">Haben</th><th class="right">Schluss</th></tr></thead>
            <tbody>
                @foreach($report['data'] as $row)
                    <tr><td>{{ $row['code'] }}</td><td>{{ $row['name'] }}</td><td class="right">{{ $money($row['opening_balance']) }}</td><td class="right">{{ $money($row['period_debit']) }}</td><td class="right">{{ $money($row['period_credit']) }}</td><td class="right">{{ $money($row['closing_balance']) }}</td></tr>
                @endforeach
            </tbody>
        </table>
    @elseif($report['report_type'] === 'profit_loss')
        <div class="section">Erlöse</div>
        <table><thead><tr><th>Konto</th><th>Name</th><th>Gruppe</th><th class="right">Betrag</th></tr></thead><tbody>
            @foreach($report['data']['revenues'] as $row)<tr><td>{{ $row['code'] }}</td><td>{{ $row['name'] }}</td><td>{{ $row['group'] }}</td><td class="right">{{ $money($row['amount']) }}</td></tr>@endforeach
        </tbody></table>
        <div class="section">Aufwendungen</div>
        <table><thead><tr><th>Konto</th><th>Name</th><th>Gruppe</th><th class="right">Betrag</th></tr></thead><tbody>
            @foreach($report['data']['expenses'] as $row)<tr><td>{{ $row['code'] }}</td><td>{{ $row['name'] }}</td><td>{{ $row['group'] }}</td><td class="right">{{ $money($row['amount']) }}</td></tr>@endforeach
        </tbody></table>
    @elseif($report['report_type'] === 'balance_sheet')
        <div class="section">Aktiva</div>
        <table><thead><tr><th>Konto</th><th>Name</th><th>Kategorie</th><th class="right">Betrag</th></tr></thead><tbody>
            @foreach($report['data']['assets'] as $row)<tr><td>{{ $row['code'] }}</td><td>{{ $row['name'] }}</td><td>{{ $row['category'] }}</td><td class="right">{{ $money($row['balance']) }}</td></tr>@endforeach
        </tbody></table>
        <div class="section">Passiva</div>
        <table><thead><tr><th>Konto</th><th>Name</th><th>Kategorie</th><th class="right">Betrag</th></tr></thead><tbody>
            @foreach(array_merge($report['data']['equity'], $report['data']['liabilities']) as $row)<tr><td>{{ $row['code'] }}</td><td>{{ $row['name'] }}</td><td>{{ $row['category'] }}</td><td class="right">{{ $money($row['balance']) }}</td></tr>@endforeach
        </tbody></table>
    @elseif($report['report_type'] === 'journal')
        <table><thead><tr><th>Datum</th><th>Journal</th><th>Text</th><th>Konto</th><th class="right">Soll</th><th class="right">Haben</th><th>Status</th></tr></thead><tbody>
            @foreach($report['data']['rows'] as $row)<tr><td>{{ $row['booking_date'] }}</td><td>{{ $row['journal_number'] }}</td><td>{{ $row['description'] }}</td><td>{{ $row['account_code'] }} {{ $row['account_name'] }}</td><td class="right">{{ $money($row['debit']) }}</td><td class="right">{{ $money($row['credit']) }}</td><td>{{ $row['status'] }}</td></tr>@endforeach
        </tbody></table>
    @elseif($report['report_type'] === 'account_movements')
        <div class="section">{{ $report['data']['account']['code'] }} {{ $report['data']['account']['name'] }}</div>
        <table><thead><tr><th>Datum</th><th>Journal</th><th>Text</th><th class="right">Soll</th><th class="right">Haben</th><th class="right">Saldo</th><th>Status</th></tr></thead><tbody>
            @foreach($report['data']['movements'] as $row)<tr><td>{{ $row['booking_date'] }}</td><td>{{ $row['journal_number'] }}</td><td>{{ $row['description'] }}</td><td class="right">{{ $money($row['debit']) }}</td><td class="right">{{ $money($row['credit']) }}</td><td class="right">{{ $money($row['running_balance']) }}</td><td>{{ $row['status'] }}</td></tr>@endforeach
        </tbody></table>
    @elseif($report['report_type'] === 'vat')
        <table><thead><tr><th>Steuerschlüssel</th><th>Art</th><th class="right">Basis</th><th class="right">Steuer</th><th class="right">Anzahl</th></tr></thead><tbody>
            @foreach($report['data']['groups'] as $row)<tr><td>{{ $row['tax_key'] }}</td><td>{{ $row['bucket'] }}</td><td class="right">{{ $money($row['base_amount']) }}</td><td class="right">{{ $money($row['tax_amount']) }}</td><td class="right">{{ $row['count'] }}</td></tr>@endforeach
        </tbody></table>
    @endif

    <div class="totals">Qualitätsstatus: {{ $report['quality']['status'] }}</div>
</body>
</html>