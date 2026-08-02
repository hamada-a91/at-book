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
    <h1>ELSTER-Übertragungsbogen EÜR</h1>
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
                <th>Zeile</th>
                <th>Bezeichnung</th>
                <th class="num">Betrag</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($report['data']['rows'] as $row)
                <tr @if($row['zeile'] === 'ergebnis') style="font-weight: bold; background: #f1f5f9;" @endif>
                    <td>{{ $row['zeile'] }}</td>
                    <td>{{ $row['label'] }}</td>
                    <td class="num">{{ number_format($row['amount'] / 100, 2, ',', '.') }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <h2>Herleitung der EÜR-Zeilen</h2>
    @foreach ($report['data']['rows'] as $row)
        @if(count($row['herleitung'] ?? []) > 0)
            <div style="margin-top: 15px; page-break-inside: avoid;">
                <strong>Zeile {{ $row['zeile'] }} · {{ $row['label'] }}</strong>
                <table style="margin-top: 5px;">
                    <thead>
                        <tr>
                            <th>Datum</th>
                            <th>Dokument</th>
                            <th>Beschreibung</th>
                            <th>Konto</th>
                            <th class="num">Betrag</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($row['herleitung'] as $source)
                            <tr>
                                <td>{{ \Carbon\Carbon::parse($source['date'])->format('d.MM.yyyy') }}</td>
                                <td>{{ strtoupper($source['document_type']) }} {{ $source['document_number'] }}</td>
                                <td>{{ $source['document_title'] }}</td>
                                <td>{{ $source['account_code'] }} {{ $source['account_name'] }}</td>
                                <td class="num">{{ number_format($source['amount'] / 100, 2, ',', '.') }}</td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        @endif
    @endforeach
</body>
</html>
