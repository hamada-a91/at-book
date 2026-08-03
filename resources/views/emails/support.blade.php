<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #334155;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 32px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .header {
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .header h2 {
            margin: 0;
            color: #1e3a8a;
            font-size: 20px;
        }
        .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
            font-size: 14px;
        }
        .meta-table td {
            padding: 6px 0;
            border-bottom: 1px solid #f1f5f9;
        }
        .meta-table td.label {
            font-weight: 600;
            color: #64748b;
            width: 120px;
        }
        .message-box {
            background-color: #f1f5f9;
            border-radius: 6px;
            padding: 16px;
            white-space: pre-line;
            font-size: 15px;
            color: #1e293b;
            border-left: 4px solid #3b82f6;
        }
        .footer {
            margin-top: 32px;
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Support-Anfrage erhalten</h2>
        </div>
        
        <table class="meta-table">
            <tr>
                <td class="label">Benutzer:</td>
                <td>{{ $userName }} ({{ $userEmail }})</td>
            </tr>
            @if($tenantName)
            <tr>
                <td class="label">Mandant (Tenant):</td>
                <td>{{ $tenantName }} (Slug: {{ $tenantSlug }})</td>
            </tr>
            @endif
            <tr>
                <td class="label">Betreff:</td>
                <td><strong>{{ $supportSubject }}</strong></td>
            </tr>
            <tr>
                <td class="label">Datum/Zeit:</td>
                <td>{{ now()->format('d.m.Y H:i:s') }}</td>
            </tr>
        </table>
        
        <div class="message-box">
            {{ $supportMessage }}
        </div>
        
        <div class="footer">
            Diese E-Mail wurde automatisch vom AT-Book Support-System generiert.
        </div>
    </div>
</body>
</html>
