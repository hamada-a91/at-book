<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AT-Book - Accounting System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }
    </style>
</head>
<body class="min-h-screen">
    <div class="container mx-auto py-8 px-4">
        <!-- Header -->
        <header class="mb-8">
            <h1 class="text-5xl font-bold text-slate-900 mb-2">AT-Book</h1>
            <p class="text-slate-600 text-lg">GoBD-Compliant Accounting System</p>
        </header>

        <!-- Navigation -->
        <nav class="mb-8 bg-white rounded-lg shadow-md p-4">
            <div class="flex gap-4">
                <a href="/" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Dashboard</a>
                <a href="/bookings" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300">Buchungen</a>
                <a href="/accounts" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300">Kontenplan</a>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <!-- Stats Card 1 -->
            <div class="bg-white rounded-xl shadow-lg p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-slate-500 text-sm">Offene Buchungen</p>
                        <p class="text-3xl font-bold text-slate-900 mt-2">0</p>
                    </div>
                    <div class="bg-blue-100 p-3 rounded-full">
                        <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </div>
                </div>
            </div>

            <!-- Stats Card 2 -->
            <div class="bg-white rounded-xl shadow-lg p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-slate-500 text-sm">Konten (SKR03)</p>
                        <p class="text-3xl font-bold text-slate-900 mt-2" id="accountCount">...</p>
                    </div>
                    <div class="bg-green-100 p-3 rounded-full">
                        <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                        </svg>
                    </div>
                </div>
            </div>

            <!-- Stats Card 3 -->
            <div class="bg-white rounded-xl shadow-lg p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-slate-500 text-sm">System Status</p>
                        <p class="text-3xl font-bold text-green-600 mt-2">✓ Online</p>
                    </div>
                    <div class="bg-purple-100 p-3 rounded-full">
                        <svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                </div>
            </div>
        </div>

        <!-- Quick Actions -->
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 class="text-2xl font-bold text-slate-900 mb-4">Schnellaktionen</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a href="/bookings/create" class="flex items-center p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition">
                    <div class="bg-blue-100 p-3 rounded-full mr-4">
                        <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="font-semibold text-slate-900">Neue Buchung</h3>
                        <p class="text-sm text-slate-600">Buchungssatz erstellen</p>
                    </div>
                </a>

                <a href="/api/accounts" class="flex items-center p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition">
                    <div class="bg-green-100 p-3 rounded-full mr-4">
                        <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="font-semibold text-slate-900">Kontenplan anzeigen</h3>
                        <p class="text-sm text-slate-600">SKR03 Konten (API)</p>
                    </div>
                </a>
            </div>
        </div>

        <!-- API Documentation -->
        <div class="bg-white rounded-xl shadow-lg p-6">
            <h2 class="text-2xl font-bold text-slate-900 mb-4">API Endpunkte</h2>
            <div class="space-y-3">
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                        <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">GET</span>
                        <code class="ml-2 text-sm">/api/accounts</code>
                    </div>
                    <a href="/api/accounts" target="_blank" class="text-blue-600 hover:underline text-sm">Testen →</a>
                </div>

                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                        <span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">POST</span>
                        <code class="ml-2 text-sm">/api/bookings</code>
                    </div>
                    <span class="text-slate-500 text-sm">Buchung erstellen</span>
                </div>

                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                        <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">GET</span>
                        <code class="ml-2 text-sm">/api/bookings</code>
                    </div>
                    <a href="/api/bookings" target="_blank" class="text-blue-600 hover:underline text-sm">Testen →</a>
                </div>

                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                        <span class="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">POST</span>
                        <code class="ml-2 text-sm">/api/bookings/{id}/lock</code>
                    </div>
                    <span class="text-slate-500 text-sm">Buchung sperren (GoBD)</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Fetch account count
        fetch('/api/accounts')
            .then(res => res.json())
            .then(data => {
                document.getElementById('accountCount').textContent = data.length;
            })
            .catch(err => {
                document.getElementById('accountCount').textContent = 'Fehler';
                console.error('API Error:', err);
            });
    </script>
</body>
</html>
