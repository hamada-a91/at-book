import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Trash2, Send, Download, FileText, Calendar, Euro, Receipt, Eye } from 'lucide-react';
import { Beleg } from '@/types/beleg';

export function BelegView() {
    const navigate = useNavigate();
    const { tenant, id } = useParams<{ tenant: string; id: string }>();
    const queryClient = useQueryClient();

    const { data: beleg, isLoading } = useQuery<Beleg>({
        queryKey: ['beleg', id],
        queryFn: async () => {
            const { data } = await axios.get(`/api/belege/${id}`);
            return data;
        },
    });

    const { data: filePreviewUrl } = useQuery({
        queryKey: ['beleg-file-preview', id],
        queryFn: async () => {
            if (!id) return null;
            try {
                const response = await axios.get(`/api/belege/${id}/download`, {
                    responseType: 'blob'
                });
                return window.URL.createObjectURL(response.data);
            } catch (error) {
                console.error('Error fetching file preview', error);
                return null;
            }
        },
        enabled: !!beleg?.file_path,
        staleTime: 5 * 60 * 1000,
    });

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const { data } = await axios.delete(`/api/belege/${id}`);
            return data;
        },
        onSuccess: () => {
            navigate(`/${tenant}/belege`);
        },
    });

    const bookMutation = useMutation({
        mutationFn: async () => {
            const { data } = await axios.post(`/api/belege/${id}/book`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['beleg', id] });
            queryClient.invalidateQueries({ queryKey: ['belege'] });
        },
    });

    const handleDelete = () => {
        if (confirm('Beleg wirklich löschen?')) {
            deleteMutation.mutate();
        }
    };

    const handleBook = () => {
        if (confirm('Beleg jetzt buchen? Dies kann nicht rückgängig gemacht werden.')) {
            bookMutation.mutate();
        }
    };

    const handleDownload = async () => {
        try {
            const response = await axios.get(`/api/belege/${id}/download`, {
                responseType: 'blob',
            });

            // Get filename from content-disposition if possible, or use beleg filename
            const contentDisposition = response.headers['content-disposition'];
            let filename = beleg?.file_name || `beleg-${id}`;

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error: any) {
            console.error('Download error:', error);
            let message = 'Fehler beim Herunterladen der Datei';

            if (error.response && error.response.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const json = JSON.parse(text);
                    if (json.message || json.error) {
                        message = json.message || json.error;
                    }
                } catch (e) {
                    // Ignore parse error
                }
            } else if (error.message) {
                message = error.message;
            }

            alert(message);
        }
    };

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
        }).format(cents / 100);
    };

    const typeStyles: Record<string, string> = {
        ausgang: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        eingang: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
        offen: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
        sonstige: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200 dark:border-slate-800',
    };

    const typeLabels: Record<string, string> = {
        ausgang: 'Ausgangsbeleg',
        eingang: 'Eingangsbeleg',
        offen: 'Offener Beleg',
        sonstige: 'Sonstiges',
    };

    const statusStyles: Record<string, string> = {
        draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        booked: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
        cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    };

    const statusLabels: Record<string, string> = {
        draft: 'Entwurf',
        booked: 'Gebucht',
        paid: 'Bezahlt',
        cancelled: 'Storniert',
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800 rounded-full mb-4"></div>
                    <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
            </div>
        );
    }

    if (!beleg) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">Beleg nicht gefunden</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to={`/${tenant}/belege`}>
                        <Button variant="ghost" size="icon" className="h-10 w-10">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            {beleg.document_number}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">{beleg.title}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {beleg.file_path && (
                        <Button variant="outline" onClick={handleDownload} className="gap-2">
                            <Download className="w-4 h-4" />
                            Datei herunterladen
                        </Button>
                    )}
                    {beleg.status === 'draft' && (
                        <>
                            <Button variant="outline" onClick={() => navigate(`/${tenant}/belege/${id}/edit`)} className="gap-2">
                                <Edit className="w-4 h-4" />
                                Bearbeiten
                            </Button>
                            <Button variant="default" onClick={handleBook} disabled={bookMutation.isPending} className="gap-2">
                                <Send className="w-4 h-4" />
                                Buchen
                            </Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending} className="gap-2">
                                <Trash2 className="w-4 h-4" />
                                Löschen
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Status and Type Badges */}
            <div className="flex gap-2">
                <Badge variant="outline" className={`font-normal ${typeStyles[beleg.document_type]}`}>
                    {typeLabels[beleg.document_type]}
                </Badge>
                <Badge variant="outline" className={`font-normal ${statusStyles[beleg.status]}`}>
                    {statusLabels[beleg.status]}
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Document Info */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-primary" />
                                Belegdetails
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Belegnummer</p>
                                    <p className="font-mono font-medium text-slate-900 dark:text-slate-100">
                                        {beleg.document_number}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Belegdatum</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                        {new Date(beleg.document_date).toLocaleDateString('de-DE')}
                                    </p>
                                </div>
                                {beleg.due_date && (
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Fälligkeitsdatum</p>
                                        <p className="font-medium text-slate-900 dark:text-slate-100">
                                            {new Date(beleg.due_date).toLocaleDateString('de-DE')}
                                        </p>
                                    </div>
                                )}
                                {beleg.contact && (
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Kontakt</p>
                                        <p className="font-medium text-slate-900 dark:text-slate-100">
                                            {beleg.contact.name}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {beleg.notes && (
                                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Notizen</p>
                                    <p className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                                        {beleg.notes}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Linked Booking */}
                    {beleg.journalEntry && (
                        <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    Verknüpfte Buchung
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div>
                                        <p className="font-medium text-slate-900 dark:text-slate-100">
                                            {beleg.journalEntry.description}
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {new Date(beleg.journalEntry.booking_date).toLocaleDateString('de-DE')}
                                        </p>
                                    </div>
                                    <Link to={`/${tenant}/bookings`}>
                                        <Button variant="outline" size="sm">
                                            Buchung ansehen
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* File Preview */}
                    {beleg.file_path && (
                        <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Eye className="w-5 h-5 text-primary" />
                                    Vorschau
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {beleg.file_name?.match(/\.(jpg|jpeg|png|gif)$/i) && filePreviewUrl && (
                                    <img
                                        src={filePreviewUrl}
                                        alt="Beleg Vorschau"
                                        className="w-full h-auto rounded-lg border border-slate-200 dark:border-slate-800"
                                    />
                                )}
                                {beleg.file_name?.match(/\.pdf$/i) && filePreviewUrl && (
                                    <iframe
                                        src={filePreviewUrl}
                                        className="w-full h-[600px] rounded-lg border border-slate-200 dark:border-slate-800"
                                        title="PDF Vorschau"
                                    />
                                )}
                                {!filePreviewUrl && (
                                    <div className="flex items-center justify-center p-12">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    </div>
                                )}
                                {!beleg.file_name?.match(/\.(jpg|jpeg|png|gif|pdf)$/i) && (
                                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                        <p className="text-slate-500 dark:text-slate-400">
                                            Keine Vorschau verfügbar für diesen Dateityp.
                                        </p>
                                        <Button variant="outline" onClick={handleDownload} className="mt-4">
                                            Herunterladen
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Amount Summary */}
                    <Card className="shadow-sm border-none bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Euro className="w-5 h-5" />
                                Beträge
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 dark:text-slate-400">Nettobetrag:</span>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                    {formatCurrency(beleg.amount - beleg.tax_amount)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 dark:text-slate-400">Steuerbetrag:</span>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                    {formatCurrency(beleg.tax_amount)}
                                </span>
                            </div>
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Gesamtbetrag:</span>
                                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                        {formatCurrency(beleg.amount)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* File Info */}
                    {beleg.file_path && (
                        <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <FileText className="w-5 h-5" />
                                    Angehängte Datei
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                            <FileText className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                {beleg.file_name}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full mt-3 gap-2"
                                    onClick={handleDownload}
                                >
                                    <Download className="w-4 h-4" />
                                    Herunterladen
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Metadata */}
                    <Card className="shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Calendar className="w-5 h-5" />
                                Metadaten
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div>
                                <p className="text-slate-500 dark:text-slate-400">Erstellt am</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                    {new Date(beleg.created_at).toLocaleString('de-DE')}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-500 dark:text-slate-400">Zuletzt geändert</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                    {new Date(beleg.updated_at).toLocaleString('de-DE')}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
