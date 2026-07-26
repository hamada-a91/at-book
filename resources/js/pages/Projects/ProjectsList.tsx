import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import axios from '@/lib/axios';
import { Plus, FolderKanban, Trash2, Building2, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ContactSelector } from '@/components/ContactSelector';
import { formatCurrency } from '@/lib/currency';

interface Project {
    id: number;
    number: string;
    name: string;
    status: 'active' | 'completed' | 'archived';
    budget_amount: number | null;
    contact?: { id: number; name: string } | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
    active: { label: 'Aktiv', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    completed: { label: 'Abgeschlossen', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    archived: { label: 'Archiviert', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

export function ProjectsList() {
    const { tenant } = useParams<{ tenant: string }>();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [name, setName] = useState('');
    const [contactId, setContactId] = useState<string | undefined>();
    const [budget, setBudget] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState<string | null>(null);

    const { data: projects, isLoading } = useQuery<Project[]>({
        queryKey: ['projects', 'list', statusFilter],
        queryFn: async () => {
            const { data } = await axios.get('/api/projects', {
                params: statusFilter !== 'all' ? { status: statusFilter } : {},
            });
            return data;
        },
    });

    const { data: contacts } = useQuery({
        queryKey: ['contacts'],
        queryFn: async () => (await axios.get('/api/contacts')).data,
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const payload: Record<string, unknown> = { name };
            if (contactId) payload.contact_id = Number(contactId);
            if (budget) payload.budget_amount = Math.round(parseFloat(budget.replace(',', '.')) * 100);
            if (notes) payload.notes = notes;
            return (await axios.post('/api/projects', payload)).data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            setDialogOpen(false);
            setName(''); setContactId(undefined); setBudget(''); setNotes(''); setError(null);
        },
        onError: (e: any) => setError(e?.response?.data?.error ?? 'Fehler beim Anlegen.'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => axios.delete(`/api/projects/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
        onError: (e: any) => alert(e?.response?.data?.error ?? 'Projekt kann nicht gelöscht werden.'),
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FolderKanban className="h-6 w-6 text-blue-600 dark:text-blue-400" /> Projekte
                    </h1>
                    <p className="text-sm text-muted-foreground">Kosten und Erlöse je Projekt – Kunden- oder interne Projekte.</p>
                </div>
                <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Neues Projekt</Button>
            </div>

            <div className="w-56">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Status</SelectItem>
                        <SelectItem value="active">Aktiv</SelectItem>
                        <SelectItem value="completed">Abgeschlossen</SelectItem>
                        <SelectItem value="archived">Archiviert</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <p className="py-8 text-center text-muted-foreground">Lade Projekte…</p>
            ) : (projects ?? []).length === 0 ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground">
                    Noch keine Projekte. Legen Sie Ihr erstes Projekt an.
                </CardContent></Card>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(projects ?? []).map((p) => (
                        <Card key={p.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                    <Link to={`/${tenant}/projects/${p.id}`} className="flex-1">
                                        <div className="text-xs text-muted-foreground font-mono">{p.number}</div>
                                        <div className="font-semibold text-lg leading-tight">{p.name}</div>
                                    </Link>
                                    <Badge className={statusLabels[p.status]?.color}>{statusLabels[p.status]?.label}</Badge>
                                </div>
                                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                                    {p.contact
                                        ? <><User className="h-3.5 w-3.5" /> {p.contact.name}</>
                                        : <><Building2 className="h-3.5 w-3.5" /> Internes Projekt</>}
                                </div>
                                {p.budget_amount != null && (
                                    <div className="mt-1 text-sm">Budget: {formatCurrency(p.budget_amount / 100)}</div>
                                )}
                                <div className="mt-3 flex justify-end">
                                    <Button variant="ghost" size="sm"
                                        onClick={() => { if (confirm(`Projekt "${p.name}" löschen?`)) deleteMutation.mutate(p.id); }}>
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Neues Projekt</DialogTitle>
                        <DialogDescription>Ein Kunde ist optional – ohne Kunde entsteht ein internes Projekt.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Projektname *</label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. BieneB oder Website Kunde X" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Kunde (optional)</label>
                            <ContactSelector contacts={contacts} value={contactId} onChange={setContactId} />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Budget (€, optional)</label>
                            <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="z.B. 10000" inputMode="decimal" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Notizen</label>
                            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
                        <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending}>
                            {createMutation.isPending ? 'Speichere…' : 'Anlegen'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
