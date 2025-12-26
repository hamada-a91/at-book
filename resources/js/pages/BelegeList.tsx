import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from '@/lib/axios';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus, FileText, Trash2, Eye, Edit, Search, Download, Upload, Send, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Beleg, BelegType, BelegStatus } from '@/types/beleg';

export function BelegeList() {
    const navigate = useNavigate();
    const { tenant } = useParams();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<BelegType | 'all'>('all');
    const [filterStatus, setFilterStatus] = useState<BelegStatus | 'all'>('all');

    const { data: belege, isLoading } = useQuery<Beleg[]>({
        queryKey: ['belege', filterType, filterStatus],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filterType !== 'all') params.append('document_type', filterType);
            if (filterStatus !== 'all') params.append('status', filterStatus);
            const { data } = await axios.get(`/api/belege?${params.toString()}`);
            return data;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const { data } = await axios.delete(`/api/belege/${id}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['belege'] });
        },
    });

    const bookMutation = useMutation({
        mutationFn: async (id: number) => {
            const { data } = await axios.post(`/api/belege/${id}/book`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['belege'] });
        },
    });

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
        paid: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
        cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    };

    const statusLabels: Record<string, string> = {
        draft: 'Entwurf',
        booked: 'Gebucht',
        paid: 'Bezahlt',
        cancelled: 'Storniert',
    };

    const handleDelete = (id: number) => {
        if (confirm('Beleg wirklich löschen?')) {
            deleteMutation.mutate(id);
        }
    };

    const handleBook = (id: number) => {
        if (confirm('Beleg jetzt buchen? Dies kann nicht rückgängig gemacht werden.')) {
            bookMutation.mutate(id);
        }
    };

    const handleDownload = async (id: number) => {
        try {
            const response = await axios.get(`/api/belege/${id}/download`, {
                responseType: 'blob',
            });

            // Get filename from content-disposition if possible, or fallback
            // Note: Accessing content-disposition header might depend on CORS exposure
            const contentDisposition = response.headers['content-disposition'];
            let filename = `beleg-${id}`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }
            // Fallback extension if not in filename
            if (!filename.includes('.')) {
                filename += '.pdf'; // Default Assumption, though backend might send others
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Download error:', error);
            alert('Fehler beim Herunterladen der Datei');
        }
    };

    const filteredBelege = belege?.filter(beleg =>
        beleg.document_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        beleg.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        beleg.contact?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Belege</h1>
                    <p className="text-slate-500 dark:text-slate-400">Verwalten Sie Ihre Geschäftsbelege</p>
                </div>
                <Link to={`/${tenant}/belege/create`}>
                    <Button className="shadow-lg shadow-purple-100/20 hover:shadow-purple-200/30 transition-all duration-300 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Neuer Beleg
                    </Button>
                </Link>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    variant={filterType === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType('all')}
                    className="gap-2"
                >
                    <Receipt className="w-4 h-4" />
                    Alle
                </Button>
                <Button
                    variant={filterType === 'ausgang' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType('ausgang')}
                    className="gap-2"
                >
                    <Upload className="w-4 h-4" />
                    Ausgangsbelege
                </Button>
                <Button
                    variant={filterType === 'eingang' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType('eingang')}
                    className="gap-2"
                >
                    <Download className="w-4 h-4" />
                    Eingangsbelege
                </Button>
                <Button
                    variant={filterType === 'offen' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType('offen')}
                    className="gap-2"
                >
                    <FileText className="w-4 h-4" />
                    Offene Belege
                </Button>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Suchen nach Nummer, Titel oder Kontakt..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                    />
                </div>
                <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as BelegStatus | 'all')}>
                    <SelectTrigger className="w-[180px] bg-white dark:bg-slate-950">
                        <SelectValue placeholder="Status filtern" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Status</SelectItem>
                        <SelectItem value="draft">Entwurf</SelectItem>
                        <SelectItem value="booked">Gebucht</SelectItem>
                        <SelectItem value="paid">Bezahlt</SelectItem>
                        <SelectItem value="cancelled">Storniert</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Beleg List */}
            <Card className="w-full shadow-sm border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                {isLoading ? (
                    <CardContent className="p-12 flex justify-center">
                        <div className="animate-pulse flex flex-col items-center">
                            <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800 rounded-full mb-4"></div>
                            <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
                        </div>
                    </CardContent>
                ) : filteredBelege && filteredBelege.length === 0 ? (
                    <CardContent className="p-12 text-center text-slate-500 dark:text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Receipt className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">Keine Belege gefunden</h3>
                        <p className="mb-6">Erstellen Sie Ihren ersten Beleg, um loszulegen.</p>
                        <Link to={`/${tenant}/belege/create`}>
                            <Button variant="link" className="text-purple-600 hover:text-purple-800 p-0 h-auto font-normal">
                                Jetzt einen hochladen
                            </Button>
                        </Link>
                    </CardContent>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Nr.
                                    </th>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Typ
                                    </th>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Titel
                                    </th>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Kontakt
                                    </th>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Datum
                                    </th>
                                    <th className="px-6 py-4 text-right font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Betrag
                                    </th>
                                    <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-right font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                                        Aktionen
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredBelege?.map((beleg) => (
                                    <tr key={beleg.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                                            {beleg.document_number}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className={`font-normal ${typeStyles[beleg.document_type]}`}>
                                                {typeLabels[beleg.document_type]}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900 dark:text-slate-100">{beleg.title}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            {beleg.contact?.name || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            {new Date(beleg.document_date).toLocaleDateString('de-DE')}
                                        </td>
                                        <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                                            {formatCurrency(beleg.amount)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className={`font-normal ${statusStyles[beleg.status]}`}>
                                                {statusLabels[beleg.status]}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* View Button */}
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                    onClick={() => navigate(`/${tenant}/belege/${beleg.id}`)}
                                                    title="Ansehen"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>

                                                {/* Download File Button */}
                                                {beleg.file_path && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20"
                                                        onClick={() => handleDownload(beleg.id)}
                                                        title="Datei herunterladen"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </Button>
                                                )}

                                                {beleg.status === 'draft' && (
                                                    <>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                            onClick={() => handleBook(beleg.id)}
                                                            disabled={bookMutation.isPending}
                                                            title="Buchen"
                                                        >
                                                            <Send className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                                            onClick={() => navigate(`/${tenant}/belege/${beleg.id}/edit`)}
                                                            title="Bearbeiten"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                                            onClick={() => handleDelete(beleg.id)}
                                                            disabled={deleteMutation.isPending}
                                                            title="Löschen"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
