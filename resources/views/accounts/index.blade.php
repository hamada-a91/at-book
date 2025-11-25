<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kontenplan - AT-Book</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
</head>
<body class="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
    <div class="container mx-auto py-8 px-4">
        <!-- Header -->
        <div class="mb-6">
            <a href="/" class="text-blue-600 hover:underline mb-2 inline-block">← Zurück zum Dashboard</a>
            <h1 class="text-4xl font-bold text-slate-900">Kontenplan (SKR03)</h1>
            <p class="text-slate-600">Standard-Kontenrahmen für Deutschland</p>
        </div>

        <!-- Filters -->
        <div class="bg-white rounded-xl shadow-lg p-6 mb-6" x-data="{ search: '', type: 'all' }">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" x-model="search" @input="filterAccounts(search, type)"
                       placeholder="Suche nach Konto-Nr. oder Name..."
                       class="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                
                <select x-model="type" @change="filterAccounts(search, type)"
                        class="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="all">Alle Kontenarten</option>
                    <option value="asset">Aktiva</option>
                    <option value="liability">Passiva</option>
                    <option value="revenue">Erlöse</option>
                    <option value="expense">Aufwand</option>
                </select>
            </div>
        </div>

        <!-- Accounts Table -->
        <div class="bg-white rounded-xl shadow-lg overflow-hidden" x-data="accountsTable()">
            <div x-show="loading" class="p-8 text-center">
                <p class="text-slate-600">Lade Kontenplan...</p>
            </div>

            <div x-show="!loading && filteredAccounts.length === 0" class="p-8 text-center">
                <p class="text-slate-600">Keine Konten gefunden.</p>
            </div>

            <div x-show="!loading && filteredAccounts.length > 0">
                <table class="w-full">
                    <thead class="bg-slate-100 border-b border-slate-200">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Konto-Nr.</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Bezeichnung</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Kontenart</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Steuerschlüssel</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                        <template x-for="account in filteredAccounts" :key="account.id">
                            <tr class="hover:bg-slate-50 transition">
                                <td class="px-6 py-4">
                                    <span class="font-mono font-bold text-slate-900" x-text="account.code"></span>
                                </td>
                                <td class="px-6 py-4 text-sm text-slate-700" x-text="account.name"></td>
                                <td class="px-6 py-4">
                                    <span class="px-2 py-1 text-xs font-semibold rounded-full"
                                          :class="{
                                              'bg-blue-100 text-blue-700': account.type === 'asset',
                                              'bg-red-100 text-red-700': account.type === 'liability',
                                              'bg-green-100 text-green-700': account.type === 'revenue',
                                              'bg-yellow-100 text-yellow-700': account.type === 'expense',
                                              'bg-purple-100 text-purple-700': account.type === 'equity'
                                          }"
                                          x-text="getTypeLabel(account.type)">
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-sm text-slate-700">
                                    <span x-text="account.tax_key_code || '-'"></span>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>

                <!-- Summary -->
                <div class="bg-slate-50 px-6 py-4 border-t border-slate-200">
                    <p class="text-sm text-slate-600">
                        Zeige <span class="font-semibold" x-text="filteredAccounts.length"></span> von 
                        <span class="font-semibold" x-text="allAccounts.length"></span> Konten
                    </p>
                </div>
            </div>
        </div>

        <!-- Account Type Legend -->
        <div class="mt-6 bg-white rounded-xl shadow-lg p-6">
            <h3 class="font-bold text-lg mb-4">Kontenarten</h3>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div class="flex items-center gap-2">
                    <span class="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Aktiva</span>
                    <span class="text-sm text-slate-600">Vermögen</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">Passiva</span>
                    <span class="text-sm text-slate-600">Schulden</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">Eigenkapital</span>
                    <span class="text-sm text-slate-600">Kapital</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Erlöse</span>
                    <span class="text-sm text-slate-600">Einnahmen</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">Aufwand</span>
                    <span class="text-sm text-slate-600">Ausgaben</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        function accountsTable() {
            return {
                allAccounts: [],
                filteredAccounts: [],
                loading: true,

                getTypeLabel(type) {
                    const labels = {
                        'asset': 'Aktiva',
                        'liability': 'Passiva',
                        'equity': 'Eigenkapital',
                        'revenue': 'Erlöse',
                        'expense': 'Aufwand'
                    };
                    return labels[type] || type;
                },

                filterAccounts(search, type) {
                    let filtered = this.allAccounts;

                    // Filter by type
                    if (type !== 'all') {
                        filtered = filtered.filter(acc => acc.type === type);
                    }

                    // Filter by search
                    if (search) {
                        const searchLower = search.toLowerCase();
                        filtered = filtered.filter(acc => 
                            acc.code.toLowerCase().includes(searchLower) ||
                            acc.name.toLowerCase().includes(searchLower)
                        );
                    }

                    this.filteredAccounts = filtered;
                },

                async init() {
                    try {
                        const response = await fetch('/api/accounts');
                        this.allAccounts = await response.json();
                        this.filteredAccounts = this.allAccounts;
                    } catch (error) {
                        console.error('Fehler beim Laden der Konten:', error);
                    } finally {
                        this.loading = false;
                    }
                }
            }
        }
    </script>
</body>
</html>
