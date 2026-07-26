import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface CostCenter { id: number; code: string; name: string; active: boolean; }

interface CostCenterSelectorProps {
    value: string | undefined;
    onChange: (value: string | undefined) => void;
}

const NONE = '__none__';

/** SPEC-08: Kostenstelle (KOST1) auswählen – nur aktive. */
export function CostCenterSelector({ value, onChange }: CostCenterSelectorProps) {
    const { data: items } = useQuery<CostCenter[]>({
        queryKey: ['cost-centers', 'active'],
        queryFn: async () => (await axios.get('/api/cost-centers', { params: { active_only: true } })).data,
    });

    return (
        <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? undefined : v)}>
            <SelectTrigger><SelectValue placeholder="Keine Kostenstelle" /></SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>Keine Kostenstelle</SelectItem>
                {(items ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.code} · {c.name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
