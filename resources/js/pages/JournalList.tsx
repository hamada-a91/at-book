import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Eye, Lock, RotateCcw, CheckCircle2, AlertCircle, X, FileText, Calendar, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
    draft: 'warning',
    posted: 'success',
    cancelled: 'destructive',
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Journal</h1>
                    <p className="text-slate-500 dark:text-slate-400">Alle Buchungen (GoBD-konform)</p>
                </div>
                <Link to="/bookings/create">
                    <Button className="gap-2 shadow-lg shadow-primary/20">
                        <Plus className="w-4 h-4" />
                        Neue Buchung
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Gesamt Buchungen</p>
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{bookingsList.length}</div>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Entwürfe</p>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-500 mt-1">{draftCount}</div>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Gebucht</p>
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500 mt-1">{postedCount}</div>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                <CardContent className="p-4">
                    <div className="flex gap-2">
                        <Button
                            variant={statusFilter === 'all' ? 'default' : 'ghost'}
                            onClick={() => setStatusFilter('all')}
                            size="sm"
                            className="rounded-full"
                        >
                            Alle
                        </Button>
                        <Button
                            variant={statusFilter === 'draft' ? 'default' : 'ghost'}
                            onClick={() => setStatusFilter('draft')}
                            size="sm"
                            className="rounded-full"
                        >
                            Entwürfe
                        </Button>
                        <Button
                            variant={statusFilter === 'posted' ? 'default' : 'ghost'}
                            onClick={() => setStatusFilter('posted')}
                            size="sm"
                            className="rounded-full"
                        >
                            Gebucht
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Bookings Table */}
            <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                {isLoading ? (
                    <CardContent className="p-12 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-slate-500 dark:text-slate-400">Lade Buchungen...</p>
                    </CardContent>
                ) : !bookingsList || bookingsList.length === 0 ? (
                    <CardContent className="p-12 text-center">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Plus className="w-6 h-6 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Keine Buchungen gefunden</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">
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
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                                <TableRow>
                                    <TableHead className="w-[80px]">ID</TableHead>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Beschreibung</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Zeilen</TableHead>
                                    <TableHead className="text-right">Aktionen</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bookingsList.map((booking) => {
                                    const canReverse = booking.status === 'posted' && booking.locked_at;
                                    const canLock = booking.status === 'draft';

                                    return (
                                        <TableRow key={booking.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                            <TableCell className="font-mono font-medium text-slate-900 dark:text-slate-100">
                                                #{booking.id}
                                            </TableCell>
                                            <TableCell className="text-slate-700 dark:text-slate-300">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-3 h-3 text-slate-400" />
                                                    {formatDate(booking.booking_date)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-slate-900 dark:text-slate-100 font-medium">
                                                {booking.description}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={statusVariants[booking.status]}>
                                                    {statusLabels[booking.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-slate-500 dark:text-slate-400">
                                                {booking.lines?.length || 0}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
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
            </Card>

            {/* Details Dialog */}
            <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl flex items-center gap-2">
                            <FileText className="w-6 h-6 text-primary" />
                            Buchungsdetails
                        </DialogTitle>
                        <DialogDescription>
                            Detaillierte Ansicht der Buchung #{selectedBooking?.id}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedBooking && (
                        <div className="space-y-6 mt-4">
                            {/* Header Info */}
                            <div className="grid grid-cols-2 gap-6 p-6 bg-slate-50/50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Buchungs-ID</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-mono">#{selectedBooking.id}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Datum</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        {formatDate(selectedBooking.booking_date)}
                                    </p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Beschreibung</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedBooking.description}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Status</p>
                                    <Badge variant={statusVariants[selectedBooking.status]}>
                                        {statusLabels[selectedBooking.status]}
                                    </Badge>
                                </div>
                                {selectedBooking.locked_at && (
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Gebucht am</p>
                                        <p className="text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                            <Lock className="w-3 h-3 text-emerald-500" />
                                            {formatDate(selectedBooking.locked_at)}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Booking Lines */}
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                                    <ArrowRight className="w-4 h-4 text-primary" />
                                    Buchungszeilen
                                </h3>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-slate-50 dark:bg-slate-800">
                                            <TableRow>
                                                <TableHead>Konto</TableHead>
                                                <TableHead>Typ</TableHead>
                                                <TableHead className="text-right">Betrag</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedBooking.lines?.map((line) => (
                                                <TableRow key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                                    <TableCell className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                                                        {line.account
                                                            ? `${line.account.code} - ${line.account.name}`
                                                            : 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={line.type === 'debit' ? 'default' : 'secondary'} className={line.type === 'debit' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'}>
                                                            {line.type === 'debit' ? 'Soll' : 'Haben'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                                                        {formatCurrency(line.amount)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                {selectedBooking.status === 'draft' && (
                                    <Button
                                        onClick={() => {
                                            handleLock(selectedBooking.id);
                                            setSelectedBooking(null);
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
        </div>
    );
}
