<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neue Buchung - AT-Book</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
</head>
<body class="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
    <div class="container mx-auto py-8 px-4">
        <!-- Header -->
        <div class="mb-6">
            <a href="/" class="text-blue-600 hover:underline mb-2 inline-block">← Zurück zum Dashboard</a>
            <h1 class="text-4xl font-bold text-slate-900">Neue Buchung</h1>
            <p class="text-slate-600">Buchungssatz erstellen (Doppelte Buchführung)</p>
        </div>

        <!-- Booking Form -->
        <div class="bg-white rounded-xl shadow-lg p-6" x-data="bookingForm()">
            <form @submit.prevent="submitBooking">
                <!-- Header Information -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">Datum *</label>
                        <input type="date" x-model="booking.date" required
                               class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">Beschreibung *</label>
                        <input type="text" x-model="booking.description" required
                               placeholder="z.B. Büromaterial Einkauf"
                               class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                </div>

                <!-- Booking Lines -->
                <div class="mb-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold text-slate-900">Buchungszeilen</h3>
                        <button type="button" @click="addLine" 
                                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                            + Zeile hinzufügen
                        </button>
                    </div>

                    <template x-for="(line, index) in booking.lines" :key="index">
                        <div class="grid grid-cols-12 gap-3 mb-3 p-4 bg-slate-50 rounded-lg">
                            <!-- Account Selection -->
                            <div class="col-span-5">
                                <label class="block text-xs font-medium text-slate-600 mb-1">Konto</label>
                                <select x-model="line.account_id" required
                                        class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                                    <option value="">Konto wählen...</option>
                                    <template x-for="account in accounts" :key="account.id">
                                        <option :value="account.id" x-text="`${account.code} - ${account.name}`"></option>
                                    </template>
                                </select>
                            </div>

                            <!-- Type (Soll/Haben) -->
                            <div class="col-span-2">
                                <label class="block text-xs font-medium text-slate-600 mb-1">Typ</label>
                                <select x-model="line.type" required
                                        class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                                    <option value="debit">Soll</option>
                                    <option value="credit">Haben</option>
                                </select>
                            </div>

                            <!-- Amount -->
                            <div class="col-span-3">
                                <label class="block text-xs font-medium text-slate-600 mb-1">Betrag (€)</label>
                                <input type="number" x-model.number="line.amount" step="0.01" min="0" required
                                       class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                            </div>

                            <!-- Delete Button -->
                            <div class="col-span-2 flex items-end">
                                <button type="button" @click="removeLine(index)" 
                                        :disabled="booking.lines.length <= 2"
                                        class="w-full px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                                    Löschen
                                </button>
                            </div>
                        </div>
                    </template>
                </div>

                <!-- Balance Check -->
                <div class="mb-6 p-4 rounded-lg" :class="isBalanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
                    <div class="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <span class="font-medium text-slate-700">Soll:</span>
                            <span class="ml-2 font-bold" x-text="formatCurrency(debitSum)"></span>
                        </div>
                        <div>
                            <span class="font-medium text-slate-700">Haben:</span>
                            <span class="ml-2 font-bold" x-text="formatCurrency(creditSum)"></span>
                        </div>
                        <div>
                            <span class="font-medium" :class="isBalanced ? 'text-green-700' : 'text-red-700'">
                                <span x-show="isBalanced">✓ Ausgeglichen</span>
                                <span x-show="!isBalanced">✗ Nicht ausgeglichen</span>
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Error Message -->
                <div x-show="errorMessage" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p class="text-red-700 text-sm" x-text="errorMessage"></p>
                </div>

                <!-- Success Message -->
                <div x-show="successMessage" class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p class="text-green-700 text-sm" x-text="successMessage"></p>
                </div>

                <!-- Submit Buttons -->
                <div class="flex gap-3">
                    <button type="submit" :disabled="!isBalanced || loading"
                            class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                        <span x-show="!loading">Buchung speichern (Entwurf)</span>
                        <span x-show="loading">Wird gespeichert...</span>
                    </button>
                    <a href="/" class="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-semibold text-center">
                        Abbrechen
                    </a>
                </div>
            </form>
        </div>
    </div>

    <script>
        function bookingForm() {
            return {
                accounts: [],
                loading: false,
                errorMessage: '',
                successMessage: '',
                booking: {
                    date: new Date().toISOString().split('T')[0],
                    description: '',
                    lines: [
                        { account_id: '', type: 'debit', amount: 0 },
                        { account_id: '', type: 'credit', amount: 0 }
                    ]
                },

                get debitSum() {
                    return this.booking.lines
                        .filter(l => l.type === 'debit')
                        .reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
                },

                get creditSum() {
                    return this.booking.lines
                        .filter(l => l.type === 'credit')
                        .reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
                },

                get isBalanced() {
                    return Math.abs(this.debitSum - this.creditSum) < 0.01 && this.debitSum > 0;
                },

                formatCurrency(amount) {
                    return new Intl.NumberFormat('de-DE', { 
                        style: 'currency', 
                        currency: 'EUR' 
                    }).format(amount);
                },

                addLine() {
                    this.booking.lines.push({ account_id: '', type: 'debit', amount: 0 });
                },

                removeLine(index) {
                    if (this.booking.lines.length > 2) {
                        this.booking.lines.splice(index, 1);
                    }
                },

                async submitBooking() {
                    this.loading = true;
                    this.errorMessage = '';
                    this.successMessage = '';

                    try {
                        // Convert amounts to cents
                        const payload = {
                            date: this.booking.date,
                            description: this.booking.description,
                            lines: this.booking.lines.map(line => ({
                                account_id: parseInt(line.account_id),
                                type: line.type,
                                amount: Math.round(parseFloat(line.amount) * 100), // Convert to cents
                                tax_key: null,
                                tax_amount: 0
                            }))
                        };

                        const response = await fetch('/api/bookings', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify(payload)
                        });

                        const data = await response.json();

                        if (response.ok) {
                            this.successMessage = `Buchung erfolgreich erstellt! ID: ${data.id}`;
                            setTimeout(() => {
                                window.location.href = '/bookings';
                            }, 2000);
                        } else {
                            this.errorMessage = data.error || data.message || 'Fehler beim Speichern';
                        }
                    } catch (error) {
                        this.errorMessage = 'Netzwerkfehler: ' + error.message;
                    } finally {
                        this.loading = false;
                    }
                },

                async init() {
                    // Load accounts
                    try {
                        const response = await fetch('/api/accounts');
                        this.accounts = await response.json();
                    } catch (error) {
                        this.errorMessage = 'Fehler beim Laden der Konten';
                    }
                }
            }
        }
    </script>
</body>
</html>
