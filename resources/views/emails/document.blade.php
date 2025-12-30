<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .body-content {
            white-space: pre-line;
            margin-bottom: 24px;
        }
        .signature {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #eee;
            white-space: pre-line;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="body-content">
        {!! nl2br(e($body)) !!}
    </div>
    
    @if($signature)
    <div class="signature">
        {!! nl2br(e($signature)) !!}
    </div>
    @endif
</body>
</html>
