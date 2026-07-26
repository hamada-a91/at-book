import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import axios from '@/lib/axios';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DimensionDashboard } from '@/components/DimensionDashboard';

interface Project { id: number; number: string; name: string; status: string; contact?: { name: string } | null; }

export function ProjectDetail() {
    const { tenant, id } = useParams<{ tenant: string; id: string }>();

    const { data: project } = useQuery<Project>({
        queryKey: ['project', id],
        queryFn: async () => (await axios.get(`/api/projects/${id}`)).data,
    });

    return (
        <div className="space-y-4">
            <Link to={`/${tenant}/projects`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Zurück zu Projekten
            </Link>

            <div className="flex items-center gap-3">
                <div>
                    <div className="text-xs font-mono text-muted-foreground">{project?.number}</div>
                    <h1 className="text-2xl font-bold">{project?.name}</h1>
                </div>
                {project?.contact
                    ? <Badge variant="secondary">{project.contact.name}</Badge>
                    : <Badge variant="secondary">Internes Projekt</Badge>}
            </div>

            {id && (
                <DimensionDashboard
                    basePath={`/api/projects/${id}`}
                    queryKey={`project-${id}`}
                    showBudget
                    pdfName={`Kosten-Nachweis-${project?.number ?? id}.pdf`}
                    auditableType="project"
                    auditableId={Number(id)}
                />
            )}
        </div>
    );
}
