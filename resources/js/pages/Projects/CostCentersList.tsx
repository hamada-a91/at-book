import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import axios from '@/lib/axios';
import { Plus, Trash2, SlidersHorizontal, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Dimension { id: number; code: string; name: string; active: boolean; }

function DimensionManager({ resource, singular }: { resource: 'cost-centers' | 'cost-objects'; singular: string }) {
    const { tenant } = useParams<{ tenant: string }>();
    const queryClient = useQueryClient();
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const key = ['dimensions', resource];

    const { data: items } = useQuery<Dimension[]>({
        queryKey: key,
        queryFn: async () => (await axios.get(`/api/${resource}`)).data,
    });

    const createMutation = useMutation({
        mutationFn: async () => (await axios.post(`/api/${resource}`, { code, name })).data,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: key }); setCode(''); setName(''); setError(null); },
        onError: (e: any) => setError(e?.response?.data?.error ?? 'Fehler beim Anlegen.'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => axios.delete(`/api/${resource}/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
        onError: (e: any) => alert(e?.response?.data?.error ?? 'Kann nicht gelöscht werden (in Buchungen verwendet → deaktivieren).'),
    });

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
                <div><label className="text-xs text-muted-foreground block mb-1">Code</label>
                    <Input className="w-32" value={code} onChange={(e) => setCode(e.target.value)} placeholder="z.B. 100" /></div>
                <div className="flex-1 min-w-[180px]"><label className="text-xs text-muted-foreground block mb-1">Bezeichnung</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={singular} /></div>
                <Button onClick={() => createMutation.mutate()} disabled={!code || !name || createMutation.isPending}>
                    <Plus className="h-4 w-4 mr-1" /> Anlegen
                </Button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="divide-y rounded-md border">
                {(items ?? []).length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">Noch keine {singular}-Einträge.</p>
                ) : (items ?? []).map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-muted-foreground w-16">{d.code}</span>
                            <span>{d.name}</span>
                            {!d.active && <Badge variant="secondary">inaktiv</Badge>}
                        </div>
                        <div className="flex items-center gap-1">
                            {resource === 'cost-centers' && (
                                <Button variant="ghost" size="sm" asChild title="Auswertung öffnen">
                                    <Link to={`/${tenant}/cost-centers/${d.id}`}><BarChart3 className="h-4 w-4 text-blue-600" /></Link>
                                </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(d.id)}>
                                <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function CostCentersList() {
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <SlidersHorizontal className="h-6 w-6 text-blue-600 dark:text-blue-400" /> Kostenstellen & Kostenträger
                </h1>
                <p className="text-sm text-muted-foreground">
                    Zusatz-Dimensionen für Fortgeschrittene. Für den Alltag genügen Projekte.
                </p>
            </div>
            <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Dimensionen verwalten</CardTitle></CardHeader>
                <CardContent>
                    <Tabs defaultValue="cost-centers">
                        <TabsList>
                            <TabsTrigger value="cost-centers">Kostenstellen (wo)</TabsTrigger>
                            <TabsTrigger value="cost-objects">Kostenträger (wofür)</TabsTrigger>
                        </TabsList>
                        <TabsContent value="cost-centers"><DimensionManager resource="cost-centers" singular="Kostenstelle" /></TabsContent>
                        <TabsContent value="cost-objects"><DimensionManager resource="cost-objects" singular="Kostenträger" /></TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
