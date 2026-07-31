<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #172033; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        h2 { font-size: 13px; margin: 18px 0 8px; }
        .meta { color: #5f6b7a; margin-bottom: 18px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #eef2f7; text-align: left; border-bottom: 1px solid #c8d1dc; padding: 7px 6px; }
        td { border-bottom: 1px solid #e3e8ef; padding: 6px; vertical-align: top; }
        .num { text-align: right; white-space: nowrap; }
        .calc td { font-weight: bold; background: #f8fafc; }
        .warn { margin-top: 16px; border: 1px solid #f0c36d; background: #fff7e0; padding: 8px; }
        .small { color: #5f6b7a; font-size: 10px; }
    </style>
</head>
<body>
    <h1>BWA</h1>
    <div class="meta">
        {{ $settings?->company_name ?? 'Unternehmen' }} ·
        {{ $report['period']['from'] }} bis {{ $report['period']['to'] }} ·
        Basis: {{ $report['basis'] }} ·
        Währung: {{ $report['currency'] }}
    </div>

    <table>
        <thead>
            <tr>
                <th>Zeile</th>
                <th>Bezeichnung</th>
                <th class="num">Periode</th>
                <th class="num">Kumuliert Jahr</th>
                <th class="num">Vorjahr</th>
                <th class="num">Abweichung</th>
                <th class="num">%</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($report['data']['rows'] as $row)
                <tr class="{{ $row['type'] === 'calculated' ? 'calc' : '' }}">
                    <td>{{ $row['code'] }}</td>
                    <td>{{ $row['label'] }}</td>
                    <td class="num">{{ number_format($row['month_value'] / 100, 2, ',', '.') }}</td>
                    <td class="num">{{ number_format($row['year_to_date_value'] / 100, 2, ',', '.') }}</td>
                    <td class="num">{{ number_format($row['previous_year_value'] / 100, 2, ',', '.') }}</td>
                    <td class="num">{{ number_format($row['deviation_amount'] / 100, 2, ',', '.') }}</td>
                    <td class="num">{{ $row['deviation_percent'] === null ? '-' : number_format($row['deviation_percent'], 2, ',', '.') }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    @if (($report['quality']['warnings'] ?? []) !== [])
        <div class="warn">
            <strong>Datenqualität</strong>
            @foreach ($report['quality']['warnings'] as $warning)
                <div>{{ $warning['message'] }} <span class="small">({{ $warning['affected_count'] }})</span></div>
            @endforeach
        </div>
    @endif
</body>
</html>
