import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Plus, Eye, Lock, RotateCcw, CheckCircle2, AlertCircle, FileText, Calendar, Search, Paperclip, Download } from 'lucide-react';
import { DateRangeSelector } from '@/components/reports/DateRangeSelector';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface JournalEntry {
    id: number;
    booking_date: string;
    description: string;
    status: 'draft' | 'posted' | 'cancelled';
    locked_at: string | null;
    lines?: JournalEntryLine[];
    beleg?: {
        id: number;
        document_number: string;
        title: string;
        file_path: string | null;
        file_name: string | null;
    };
}

// ... (rest of imports and interfaces)



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

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
    draft: 'warning',
    posted: 'success',
    cancelled: 'destructive',
};

export function JournalList() {
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'posted'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
    });
    const [selectedBooking, setSelectedBooking] = useState<JournalEntry | null>(null);
    const queryClient = useQueryClient();

    const { data: bookings, isLoading } = useQuery<{ data: JournalEntry[] }>({
        queryKey: ['bookings', statusFilter, searchQuery, dateRange],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (searchQuery) params.append('search', searchQuery);
            params.append('from_date', format(dateRange.from, 'yyyy-MM-dd'));
            params.append('to_date', format(dateRange.to, 'yyyy-MM-dd'));

            const res = await fetch(`/api/bookings?${params.toString()}`);
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
        <div className="space-y-8 p-1">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
                        Journal
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Alle Buchungen verwalten (GoBD-konform)
                    </p>
                </div>
                <div className="flex flex-col items-end gap-4">
                    <div className="flex gap-2">
                        <Link to="/bookings/create">
                            <Button className="shadow-lg shadow-blue-100/20 hover:shadow-blue-200/30 transition-all duration-300 bg-gradient-to-r from-blue-300 to-blue-500 hover:from-blue-700 hover:to-blue-600">
                                <Plus className="w-4 h-4 mr-2" />
                                Neue Buchung
                            </Button>
                        </Link>
                    </div>
                    <DateRangeSelector onRangeChange={(from, to) => setDateRange({ from, to })} className="w-full md:w-auto" />
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="relative overflow-hidden border-none shadow-xl bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl group hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-6 flex items-center justify-between relative z-10">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Gesamt Buchungen</p>
                            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{bookingsList.length}</div>
                        </div>
                        <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shadow-inner">
                            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="relative overflow-hidden border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl group hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-6 flex items-center justify-between relative z-10">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Entwürfe</p>
                            <div className="text-3xl font-bold text-amber-600 dark:text-amber-500 mt-2">{draftCount}</div>
                        </div>
                        <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shadow-inner">
                            <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="relative overflow-hidden border-none shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl group hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-6 flex items-center justify-between relative z-10">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Gebucht</p>
                            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-500 mt-2">{postedCount}</div>
                        </div>
                        <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shadow-inner">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Table */}
            <Card className="border-none shadow-xl bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800/50 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg">
                            <Button
                                variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
                                onClick={() => setStatusFilter('all')}
                                size="sm"
                                className={`rounded-md transition-all ${statusFilter === 'all' ? 'shadow-sm bg-white dark:bg-slate-800' : ''}`}
                            >
                                Alle
                            </Button>
                            <Button
                                variant={statusFilter === 'draft' ? 'secondary' : 'ghost'}
                                onClick={() => setStatusFilter('draft')}
                                size="sm"
                                className={`rounded-md transition-all ${statusFilter === 'draft' ? 'shadow-sm bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400' : ''}`}
                            >
                                Entwürfe
                            </Button>
                            <Button
                                variant={statusFilter === 'posted' ? 'secondary' : 'ghost'}
                                onClick={() => setStatusFilter('posted')}
                                size="sm"
                                className={`rounded-md transition-all ${statusFilter === 'posted' ? 'shadow-sm bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400' : ''}`}
                            >
                                Gebucht
                            </Button>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Suchen..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-12 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-slate-500 dark:text-slate-400">Lade Buchungen...</p>
                        </div>
                    ) : !bookingsList || bookingsList.length === 0 ? (
                        <div className="p-16 text-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                <FileText className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Keine Buchungen gefunden</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
                                {statusFilter !== 'all'
                                    ? `Es wurden keine Buchungen mit dem Status "${statusFilter === 'draft' ? 'Entwurf' : 'Gebucht'}" gefunden.`
                                    : 'Beginnen Sie mit Ihrer ersten Buchung, um Ihre Finanzen zu verwalten.'}
                            </p>
                            <Link to="/bookings/create">
                                <Button size="lg" className="shadow-lg shadow-blue-500/20">
                                    <Plus className="w-5 h-5 mr-2" />
                                    Erste Buchung erstellen
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table className="w-full">
                                <TableHeader className="bg-slate-50/80 dark:bg-slate-900/50 backdrop-blur-sm">
                                    <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                                        <TableHead className="w-[80px] font-semibold text-slate-600 dark:text-slate-300">ID</TableHead>
                                        <TableHead className="font-semibold text-slate-600 dark:text-slate-300">Datum</TableHead>
                                        <TableHead className="font-semibold text-slate-600 dark:text-slate-300">Beschreibung</TableHead>
                                        <TableHead className="font-semibold text-slate-600 dark:text-slate-300">Status</TableHead>
                                        <TableHead className="font-semibold text-slate-600 dark:text-slate-300">Zeilen</TableHead>
                                        <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-300">Aktionen</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {bookingsList.map((booking) => {
                                        const canReverse = booking.status === 'posted' && booking.locked_at;
                                        const canLock = booking.status === 'draft';

                                        return (
                                            <TableRow
                                                key={booking.id}
                                                className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors border-slate-100 dark:border-slate-800 group"
                                            >
                                                <TableCell className="font-mono font-medium text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                    #{booking.id}
                                                </TableCell>
                                                <TableCell className="text-slate-700 dark:text-slate-300">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-slate-400" />
                                                        {formatDate(booking.booking_date)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-900 dark:text-slate-100 font-medium">
                                                    {booking.description}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={statusVariants[booking.status]} className="shadow-sm">
                                                        {statusLabels[booking.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-slate-500 dark:text-slate-400">
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-mono">{booking.lines?.length || 0}</span>
                                                        <span className="text-xs text-slate-400">Pos.</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => viewDetails(booking.id)}
                                                            className="h-8 px-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                        >
                                                            <Eye className="w-4 h-4 mr-1" />
                                                            Details
                                                        </Button>
                                                        {canLock && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleLock(booking.id)}
                                                                className="h-8 px-2 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                                                disabled={lockMutation.isPending}
                                                            >
                                                                <Lock className="w-4 h-4 mr-1" />
                                                                Buchen
                                                            </Button>
                                                        )}
                                                        {canReverse && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleReverse(booking)}
                                                                className="h-8 px-2 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                                                disabled={reverseMutation.isPending}
                                                            >
                                                                <RotateCcw className="w-4 h-4 mr-1" />
                                                                Stornieren
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Details Dialog */}
            <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <span>Buchungsdetails</span>
                                <p className="text-sm font-normal text-slate-500 dark:text-slate-400 mt-1">
                                    Detaillierte Ansicht der Buchung #{selectedBooking?.id}
                                </p>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedBooking && (
                        <div className="space-y-8 mt-6">
                            {/* Header Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50/80 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Buchungs-ID</p>
                                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">#{selectedBooking.id}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Datum</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-slate-400" />
                                        {formatDate(selectedBooking.booking_date)}
                                    </p>
                                </div>
                                <div className="md:col-span-2">
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Beschreibung</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedBooking.description}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Status</p>
                                    <Badge variant={statusVariants[selectedBooking.status]} className="text-sm px-3 py-1">
                                        {statusLabels[selectedBooking.status]}
                                    </Badge>
                                </div>
                                {selectedBooking.locked_at && (
                                    <div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Gebucht am</p>
                                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full w-fit">
                                            <Lock className="w-3 h-3" />
                                            {formatDate(selectedBooking.locked_at)}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Beleg Info */}
                            {selectedBooking.beleg && (
                                <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800 p-4">
                                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                                        <Paperclip className="w-4 h-4" />
                                        Verknüpfter Beleg
                                    </h4>
                                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                                    {selectedBooking.beleg.document_number}
                                                </p>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    {selectedBooking.beleg.title}
                                                </p>
                                            </div>
                                        </div>
                                        {selectedBooking.beleg.file_path && (
                                            <a
                                                href={`/api/belege/${selectedBooking.beleg.id}/download`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <Button variant="outline" size="sm" className="gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                                    <Download className="w-4 h-4" />
                                                    Öffnen
                                                </Button>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Booking Lines */}
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                                    <div className="h-8 w-1 bg-blue-500 rounded-full"></div>
                                    Buchungszeilen
                                </h3>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                    <Table>
                                        <TableHeader className="bg-slate-50 dark:bg-slate-800/80">
                                            <TableRow>
                                                <TableHead className="font-semibold">Konto</TableHead>
                                                <TableHead className="font-semibold">Typ</TableHead>
                                                <TableHead className="text-right font-semibold">Betrag</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedBooking.lines?.map((line) => (
                                                <TableRow key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                    <TableCell className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                                                        {line.account ? (
                                                            <div className="flex flex-col">
                                                                <span className="font-mono text-xs text-slate-500">{line.account.code}</span>
                                                                <span>{line.account.name}</span>
                                                            </div>
                                                        ) : 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={line.type === 'debit' ? 'default' : 'secondary'} className={line.type === 'debit' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'}>
                                                            {line.type === 'debit' ? 'Soll' : 'Haben'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                                        {formatCurrency(line.amount)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
                                {selectedBooking.status === 'draft' && (
                                    <Button
                                        onClick={() => {
                                            handleLock(selectedBooking.id);
                                            setSelectedBooking(null);
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                                    >
                                        <Lock className="w-4 h-4 mr-2" />
                                        Jetzt buchen
                                    </Button>
                                )}
                                {selectedBooking.status === 'posted' && selectedBooking.locked_at && (
                                    <Button
                                        onClick={() => handleReverse(selectedBooking)}
                                        variant="destructive"
                                        className="shadow-lg shadow-red-500/20"
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
        </div>
    );
}
