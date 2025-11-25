import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Eye, Lock, RotateCcw, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Navigation } from '@/components/Layout/Navigation';
import { PageHeader } from '@/components/Layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface JournalEntry {
    id: number;
    booking_date: string;
    description: string;
    status: 'draft' | 'posted' | 'cancelled';
    locked_at: string | null;
    lines?: JournalEntryLine[];
}

interface JournalEntryLine {
    id: number;
    account_id: number;
    type: 'debit' | 'credit';
    amount: number;
    account?: {
        id: number;
        code: string;
        name: string;
    };
}

const statusLabels = {
    draft: 'Entwurf',
    posted: 'Gebucht',
    cancelled: 'Storniert',
};

const statusColors = {
    draft: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    posted: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const statusIcons = {
    draft: AlertCircle,
    posted: CheckCircle2,
    cancelled: X,
};

export function JournalList() {
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'posted'>('all');
    const [selectedBooking, setSelectedBooking] = useState<JournalEntry | null>(null);
    const queryClient = useQueryClient();

    const { data: bookings, isLoading } = useQuery<{ data: JournalEntry[] }>({
        queryKey: ['bookings', statusFilter],
        queryFn: async () => {
            const url = statusFilter === 'all' ? '/api/bookings' : `/api/bookings?status=${statusFilter}`;
            const res = await fetch(url);
            return res.json();
        },
    });

    const lockMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/bookings/${id}/lock`, { method: 'POST' });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Fehler beim Buchen');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            alert('✅ Buchung erfolgreich gebucht!');
        },
        onError: (error: Error) => {
            alert('❌ Fehler: ' + error.message);
        },
    });

    const reverseMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/bookings/${id}/reverse`, { method: 'POST' });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Fehler beim Stornieren');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            setSelectedBooking(null);
            alert('✅ Stornobuchung erfolgreich erstellt!');
        },
        onError: (error: Error) => {
            alert('❌ Fehler: ' + error.message);
        },
    });

    const handleLock = (id: number) => {
        if (confirm('⚠️ Buchung wirklich buchen?\n\nNach dem Buchen (GoBD-Konformität):\n- Buchung kann nicht mehr geändert werden\n- Nur Stornierung möglich')) {
            lockMutation.mutate(id);
        }
    };

    const handleReverse = (booking: JournalEntry) => {
        // Check if already cancelled
        if (booking.status === 'cancelled') {
            alert('❌ Diese Buchung wurde bereits storniert.');
            return;
        }

        if (confirm(`⚠️ Buchung "${booking.description}" wirklich stornieren?\n\nDies erstellt eine Gegenbuchung.`)) {
            reverseMutation.mutate(booking.id);
        }
    };

    const viewDetails = async (id: number) => {
        const res = await fetch(`/api/bookings/${id}`);
        const booking = await res.json();
        setSelectedBooking(booking);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount / 100);
    };

    const bookingsList = bookings?.data || [];
    const draftCount = bookingsList.filter((b) => b.status === 'draft').length;
    const postedCount = bookingsList.filter((b) => b.status === 'posted').length;

    return (
        <Navigation>
            <PageHeader
                title="Journal"
                subtitle="Alle Buchungen (GoBD-konform)"
                action={{
                    label: 'Neue Buchung',
                    icon: Plus,
                    href: '/bookings/create',
                }}
                stats={[
                    { label: 'Gesamt', value: bookingsList.length },
                    { label: 'Entwürfe', value: draftCount },
                    { label: 'Gebucht', value: postedCount },
                ]}
            />

            {/* Filters */}
            <Card className="shadow-md mb-8">
                <CardContent className="p-6">
                    <div className="flex gap-3">
                        <Button
                            variant={statusFilter === 'all' ? 'default' : 'outline'}
                            onClick={() => setStatusFilter('all')}
                        >
                            Alle ({bookingsList.length})
                        </Button>
                        <Button
                            variant={statusFilter === 'draft' ? 'default' : 'outline'}
                            onClick={() => setStatusFilter('draft')}
                        >
                            Entwürfe ({draftCount})
                        </Button>
                        <Button
                            variant={statusFilter === 'posted' ? 'default' : 'outline'}
                            onClick={() => setStatusFilter('posted')}
                        >
                            Gebucht ({postedCount})
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Bookings Table */}
            <Card className="shadow-lg">
                {isLoading ? (
                    <CardContent className="p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-slate-600">Lade Buchungen...</p>
                    </CardContent>
                ) : !bookingsList || bookingsList.length === 0 ? (
                    <CardContent className="p-12 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Plus className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Keine Buchungen gefunden</h3>
                        <p className="text-slate-600 mb-6">
                            {statusFilter !== 'all'
                                ? `Keine ${statusFilter === 'draft' ? 'Entwürfe' : 'gebuchten Einträge'} vorhanden.`
                                : 'Erstellen Sie Ihre erste Buchung.'}
                        </p>
                        <Link to="/bookings/create">
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Erste Buchung erstellen
                            </Button>
                        </Link>
                    </CardContent>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b-2 border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        Datum
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        Beschreibung
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        Zeilen
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                        Aktionen
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {bookingsList.map((booking) => {
                                    const StatusIcon = statusIcons[booking.status];
                                    const canReverse = booking.status === 'posted' && booking.locked_at;
                                    const canLock = booking.status === 'draft';

                                    return (
                                        <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                                {booking.id}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-700">
                                                {formatDate(booking.booking_date)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                                                {booking.description}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${statusColors[booking.status]
                                                        }`}
                                                >
                                                    <StatusIcon className="w-3 h-3 mr-1.5" />
                                                    {statusLabels[booking.status]}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {booking.lines?.length || 0}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => viewDetails(booking.id)}
                                                        className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        Details
                                                    </button>
                                                    {canLock && (
                                                        <button
                                                            onClick={() => handleLock(booking.id)}
                                                            className="text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                                                            disabled={lockMutation.isPending}
                                                        >
                                                            <Lock className="w-4 h-4" />
                                                            Buchen
                                                        </button>
                                                    )}
                                                    {canReverse && (
                                                        <button
                                                            onClick={() => handleReverse(booking)}
                                                            className="text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                                                            disabled={reverseMutation.isPending}
                                                        >
                                                            <RotateCcw className="w-4 h-4" />
                                                            Stornieren
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Details Dialog */}
            <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl">Buchungsdetails</DialogTitle>
                    </DialogHeader>

                    {selectedBooking && (
                        <div className="space-y-6">
                            {/* Header Info */}
                            <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-slate-600 mb-1">Buchungs-ID</p>
                                    <p className="text-lg font-semibold text-slate-900">#{selectedBooking.id}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600 mb-1">Datum</p>
                                    <p className="text-lg font-semibold text-slate-900">
                                        {formatDate(selectedBooking.booking_date)}
                                    </p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-sm text-slate-600 mb-1">Beschreibung</p>
                                    <p className="text-lg font-semibold text-slate-900">{selectedBooking.description}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600 mb-1">Status</p>
                                    <span
                                        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusColors[selectedBooking.status]
                                            }`}
                                    >
                                        {statusLabels[selectedBooking.status]}
                                    </span>
                                </div>
                                {selectedBooking.locked_at && (
                                    <div>
                                        <p className="text-sm text-slate-600 mb-1">Gebucht am</p>
                                        <p className="text-sm text-slate-900">
                                            {formatDate(selectedBooking.locked_at)}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Booking Lines */}
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Buchungszeilen</h3>
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                                                    Konto
                                                </th>
                                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                                                    Typ
                                                </th>
                                                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                                                    Betrag
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {selectedBooking.lines?.map((line) => (
                                                <tr key={line.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 text-sm text-slate-900">
                                                        {line.account
                                                            ? `${line.account.code} - ${line.account.name}`
                                                            : 'N/A'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className={`inline-flex px-2 py-1 rounded text-xs font-medium ${line.type === 'debit'
                                                                    ? 'bg-blue-100 text-blue-700'
                                                                    : 'bg-green-100 text-green-700'
                                                                }`}
                                                        >
                                                            {line.type === 'debit' ? 'Soll' : 'Haben'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-slate-900">
                                                        {formatCurrency(line.amount)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                {selectedBooking.status === 'draft' && (
                                    <Button
                                        onClick={() => {
                                            handleLock(selectedBooking.id);
                                            setSelectedBooking(null);
                                        }}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <Lock className="w-4 h-4 mr-2" />
                                        Jetzt buchen
                                    </Button>
                                )}
                                {selectedBooking.status === 'posted' && selectedBooking.locked_at && (
                                    <Button
                                        onClick={() => handleReverse(selectedBooking)}
                                        variant="destructive"
                                        disabled={reverseMutation.isPending}
                                    >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        Stornieren
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setSelectedBooking(null)}>
                                    Schließen
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Navigation>
    );
}
