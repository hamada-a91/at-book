import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import axios from '@/lib/axios';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { DimensionDashboard } from '@/components/DimensionDashboard';

interface CostCenter { id: number; code: string; name: string; active: boolean; }

export function CostCenterDetail() {
    const { tenant, id } = useParams<{ tenant: string; id: string }>();

    const { data: costCenter } = useQuery<CostCenter>({
        queryKey: ['cost-center', id],
        queryFn: async () => (await axios.get(`/api/cost-centers/${id}`)).data,
    });

    return (
        <div className="space-y-4">
            <Link to={`/${tenant}/cost-centers`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Zurück zu Kostenstellen
            </Link>

            <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <div>
                    <div className="text-xs font-mono text-muted-foreground">{costCenter?.code}</div>
                    <h1 className="text-2xl font-bold">{costCenter?.name}</h1>
                </div>
            </div>

            {id && (
                <DimensionDashboard
                    basePath={`/api/cost-centers/${id}`}
                    queryKey={`cost-center-${id}`}
                />
            )}
        </div>
    );
}
