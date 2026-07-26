import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface Project {
    id: number;
    number: string;
    name: string;
    status: string;
}

interface ProjectSelectorProps {
    value: string | undefined;
    onChange: (value: string | undefined) => void;
    /** Nur aktive Projekte anbieten (Default) */
    activeOnly?: boolean;
}

const NONE = '__none__';

/**
 * SPEC-08 (Teil B): EIN "Projekt"-Feld für Beleg-/Rechnungs-/Buchungsformulare.
 * Bewusst KEINE Kostenstellen-/Kostenträger-Begriffe in der Standard-UI –
 * der Nutzer denkt in Projekten (siehe SPEC-08, "UI-Leitprinzip").
 */
export function ProjectSelector({ value, onChange, activeOnly = true }: ProjectSelectorProps) {
    const { data: projects } = useQuery<Project[]>({
        queryKey: ['projects', activeOnly ? 'active' : 'all'],
        queryFn: async () => {
            const { data } = await axios.get('/api/projects', {
                params: activeOnly ? { status: 'active' } : {},
            });
            return data;
        },
    });

    return (
        <Select
            value={value ?? NONE}
            onValueChange={(v) => onChange(v === NONE ? undefined : v)}
        >
            <SelectTrigger>
                <SelectValue placeholder="Kein Projekt" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NONE}>Kein Projekt</SelectItem>
                {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                        {p.number} · {p.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
