import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
    title: string;
    value: string;
    icon: LucideIcon;
    delta?: number | null;
    deltaDescription?: string;
    isExpense?: boolean;
    className?: string;
}

export function KPICard({
    title,
    value,
    icon: Icon,
    delta,
    deltaDescription,
    isExpense = false,
    className,
}: KPICardProps) {
    const hasDelta = delta !== undefined && delta !== null;
    
    let isGood = false;
    if (hasDelta) {
        if (isExpense) {
            isGood = delta! < 0; // expenses decreasing is good
        } else {
            isGood = delta! > 0; // income/profit increasing is good
        }
    }

    const deltaColorClass = isGood 
        ? "text-emerald-600 dark:text-emerald-400" 
        : (delta === 0 ? "text-slate-500" : "text-rose-600 dark:text-rose-400");

    const formattedDelta = delta !== undefined && delta !== null 
        ? `${delta > 0 ? '▲' : delta < 0 ? '▼' : ''} ${Math.abs(delta).toFixed(1)}%` 
        : null;

    return (
        <Card className={cn("overflow-hidden border border-slate-200/60 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl", className)}>
            <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {title}
                    </p>
                    <div className={cn("p-2 rounded-lg", isExpense ? "text-rose-500 bg-rose-500/10" : "text-emerald-500 bg-emerald-500/10")}>
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
                <div className="flex items-baseline space-x-3 mt-1">
                    <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{value}</div>
                </div>
                {hasDelta && (
                    <div className="flex items-center gap-1.5 mt-2">
                        <span className={cn("text-xs font-semibold", deltaColorClass)}>
                            {formattedDelta}
                        </span>
                        {deltaDescription && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {deltaDescription}
                            </span>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
