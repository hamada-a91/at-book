<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Journal - AT-Book</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
</head>
<body class="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
    <div class="container mx-auto py-8 px-4">
        <!-- Header -->
        <div class="mb-6 flex justify-between items-center">
            <div>
                <a href="/" class="text-blue-600 hover:underline mb-2 inline-block">← Zurück zum Dashboard</a>
                <h1 class="text-4xl font-bold text-slate-900">Journal</h1>
                <p class="text-slate-600">Alle Buchungen (GoBD-konform)</p>
            </div>
            <a href="/bookings/create" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold">
                + Neue Buchung
            </a>
        </div>

        <!-- Filters -->
        <div class="bg-white rounded-xl shadow-lg p-6 mb-6" x-data="{ status: 'all' }">
            <div class="flex gap-4">
                <button @click="status = 'all'; loadBookings('all')"
                        :class="status === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'"
                        class="px-4 py-2 rounded-lg font-medium transition">
                    Alle
                </button>
                <button @click="status = 'draft'; loadBookings('draft')"
                        :class="status === 'draft' ? 'bg-yellow-600 text-white' : 'bg-slate-200 text-slate-700'"
                        class="px-4 py-2 rounded-lg font-medium transition">
                    Entwürfe
                </button>
                <button @click="status = 'posted'; loadBookings('posted')"
                        :class="status === 'posted' ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'"
                        class="px-4 py-2 rounded-lg font-medium transition">
                    Gebucht
                </button>
            </div>
        </div>

        <!-- Bookings Table -->
        <div class="bg-white rounded-xl shadow-lg overflow-hidden" x-data="journalTable()">
            <div x-show="loading" class="p-8 text-center">
                <p class="text-slate-600">Lade Buchungen...</p>
            </div>

            <div x-show="!loading && bookings.length === 0" class="p-8 text-center">
                <p class="text-slate-600">Keine Buchungen gefunden.</p>
                <a href="/bookings/create" class="text-blue-600 hover:underline mt-2 inline-block">
                    Erste Buchung erstellen →
                </a>
            </div>

            <div x-show="!loading && bookings.length > 0">
                <table class="w-full">
                    <thead class="bg-slate-100 border-b border-slate-200">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">ID</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Datum</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Beschreibung</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Zeilen</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                        <template x-for="booking in bookings" :key="booking.id">
                            <tr class="hover:bg-slate-50 transition">
                                <td class="px-6 py-4 text-sm font-medium text-slate-900" x-text="booking.id"></td>
                                <td class="px-6 py-4 text-sm text-slate-700" x-text="formatDate(booking.booking_date)"></td>
                                <td class="px-6 py-4 text-sm text-slate-700" x-text="booking.description"></td>
                                <td class="px-6 py-4">
                                    <span class="px-2 py-1 text-xs font-semibold rounded-full"
                                          :class="{
                                              'bg-yellow-100 text-yellow-700': booking.status === 'draft',
                                              'bg-green-100 text-green-700': booking.status === 'posted',
                                              'bg-red-100 text-red-700': booking.status === 'cancelled'
                                          }"
                                          x-text="booking.status === 'draft' ? 'Entwurf' : booking.status === 'posted' ? 'Gebucht' : 'Storniert'">
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-sm text-slate-700" x-text="booking.lines ? booking.lines.length : 0"></td>
                                <td class="px-6 py-4 text-sm">
                                    <div class="flex gap-2">
                                        <button @click="viewDetails(booking.id)" 
                                                class="text-blue-600 hover:underline">
                                            Details
                                        </button>
                                        <button x-show="booking.status === 'draft'" 
                                                @click="lockBooking(booking.id)"
                                                class="text-green-600 hover:underline">
                                            Buchen
                                        </button>
                                        <button x-show="booking.status === 'posted'" 
                                                @click="reverseBooking(booking.id)"
                                                class="text-red-600 hover:underline">
                                            Stornieren
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>

            <!-- Error Message -->
            <div x-show="errorMessage" class="p-4 bg-red-50 border-t border-red-200">
                <p class="text-red-700 text-sm" x-text="errorMessage"></p>
            </div>
        </div>

        <!-- Details Modal -->
        <div x-data="{ showModal: false, selectedBooking: null }" 
             @show-details.window="showModal = true; selectedBooking = $event.detail"
             x-show="showModal"
             class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
             style="display: none;">
            <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" @click.away="showModal = false">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-2xl font-bold text-slate-900">Buchungsdetails</h2>
                        <button @click="showModal = false" class="text-slate-500 hover:text-slate-700">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>

                    <template x-if="selectedBooking">
                        <div>
                            <div class="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <p class="text-sm text-slate-600">ID</p>
                                    <p class="font-semibold" x-text="selectedBooking.id"></p>
                                </div>
                                <div>
                                    <p class="text-sm text-slate-600">Datum</p>
                                    <p class="font-semibold" x-text="selectedBooking.booking_date"></p>
                                </div>
                                <div class="col-span-2">
                                    <p class="text-sm text-slate-600">Beschreibung</p>
                                    <p class="font-semibold" x-text="selectedBooking.description"></p>
                                </div>
                            </div>

                            <h3 class="font-bold text-lg mb-3">Buchungszeilen</h3>
                            <table class="w-full border border-slate-200 rounded-lg overflow-hidden">
                                <thead class="bg-slate-100">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-sm">Konto</th>
                                        <th class="px-4 py-2 text-left text-sm">Typ</th>
                                        <th class="px-4 py-2 text-right text-sm">Betrag</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <template x-if="selectedBooking.lines" x-for="line in selectedBooking.lines" :key="line.id">
                                        <tr class="border-t border-slate-200">
                                            <td class="px-4 py-2 text-sm" x-text="line.account ? `${line.account.code} - ${line.account.name}` : 'N/A'"></td>
                                            <td class="px-4 py-2 text-sm" x-text="line.type === 'debit' ? 'Soll' : 'Haben'"></td>
                                            <td class="px-4 py-2 text-sm text-right font-mono" x-text="formatCurrency(line.amount / 100)"></td>
                                        </tr>
                                    </template>
                                </tbody>
                            </table>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>

    <script>
        function journalTable() {
            return {
                bookings: [],
                loading: true,
                errorMessage: '',

                formatDate(dateString) {
                    return new Date(dateString).toLocaleDateString('de-DE');
                },

                formatCurrency(amount) {
                    return new Intl.NumberFormat('de-DE', { 
                        style: 'currency', 
                        currency: 'EUR' 
                    }).format(amount);
                },

                async loadBookings(status = 'all') {
                    this.loading = true;
                    this.errorMessage = '';

                    try {
                        const url = status === 'all' ? '/api/bookings' : `/api/bookings?status=${status}`;
                        const response = await fetch(url);
                        const data = await response.json();
                        this.bookings = data.data || data;
                    } catch (error) {
                        this.errorMessage = 'Fehler beim Laden der Buchungen';
                    } finally {
                        this.loading = false;
                    }
                },

                async viewDetails(id) {
                    try {
                        const response = await fetch(`/api/bookings/${id}`);
                        const booking = await response.json();
                        window.dispatchEvent(new CustomEvent('show-details', { detail: booking }));
                    } catch (error) {
                        this.errorMessage = 'Fehler beim Laden der Details';
                    }
                },

                async lockBooking(id) {
                    if (!confirm('Buchung wirklich buchen? (GoBD: Danach nicht mehr änderbar!)')) return;

                    try {
                        const response = await fetch(`/api/bookings/${id}/lock`, { method: 'POST' });
                        if (response.ok) {
                            alert('Buchung erfolgreich gebucht!');
                            this.loadBookings();
                        } else {
                            const data = await response.json();
                            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
                        }
                    } catch (error) {
                        alert('Netzwerkfehler');
                    }
                },

                async reverseBooking(id) {
                    if (!confirm('Buchung wirklich stornieren? (Erstellt eine Gegenbuchung)')) return;

                    try {
                        const response = await fetch(`/api/bookings/${id}/reverse`, { method: 'POST' });
                        if (response.ok) {
                            alert('Stornobuchung erfolgreich erstellt!');
                            this.loadBookings();
                        } else {
                            const data = await response.json();
                            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
                        }
                    } catch (error) {
                        alert('Netzwerkfehler');
                    }
                },

                init() {
                    this.loadBookings();
                }
            }
        }
    </script>
</body>
</html>
