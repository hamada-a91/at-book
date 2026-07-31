<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #172033; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        h2 { font-size: 13px; margin: 18px 0 8px; }
        .meta { color: #5f6b7a; margin-bottom: 14px; }
        .notice { border: 2px solid #a16207; background: #fff7ed; padding: 10px; margin-bottom: 16px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { background: #eef2f7; text-align: left; border-bottom: 1px solid #c8d1dc; padding: 7px 6px; }
        td { border-bottom: 1px solid #e3e8ef; padding: 6px; vertical-align: top; }
        .num { text-align: right; white-space: nowrap; }
        .small { color: #5f6b7a; font-size: 10px; }
    </style>
</head>
<body>
    <h1>ELSTER-Übertragungsbogen USt-VA</h1>
    <div class="meta">
        {{ $settings?->company_name ?? 'Unternehmen' }} ·
        {{ $report['period']['from'] }} bis {{ $report['period']['to'] }} ·
        Formularversion: {{ $report['data']['form_version'] }} ·
        Währung: {{ $report['currency'] }}
    </div>
    <div class="notice">Keine elektronische Abgabe. Werte manuell in Mein ELSTER eintragen.</div>

    <table>
        <thead>
            <tr>
                <th>Kennziffer</th>
                <th>Bezeichnung</th>
                <th class="num">Betrag</th>
                <th class="num">USt</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($report['data']['kennziffern'] as $row)
                <tr>
                    <td>{{ $row['kennziffer'] }}</td>
                    <td>{{ $row['label'] }}</td>
                    <td class="num">{{ number_format($row['amount'] / 100, 2, ',', '.') }}</td>
                    <td class="num">{{ number_format(($row['tax_amount'] ?? 0) / 100, 2, ',', '.') }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <h2>Herleitung</h2>
    @foreach ($report['data']['kennziffern'] as $row)
        <strong>Kz {{ $row['kennziffer'] }} · {{ $row['label'] }}</strong>
        <table>
            <thead>
                <tr>
                    <th>Konto</th>
                    <th>Art</th>
                    <th class="num">Betrag</th>
                </tr>
            </thead>
            <tbody>
                @foreach (array_merge($row['herleitung'] ?? [], $row['tax_herleitung'] ?? []) as $source)
                    <tr>
                        <td>{{ $source['account_code'] }} {{ $source['account_name'] }}</td>
                        <td>{{ $source['value_type'] }}</td>
                        <td class="num">{{ number_format($source['amount'] / 100, 2, ',', '.') }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endforeach
</body>
</html>
