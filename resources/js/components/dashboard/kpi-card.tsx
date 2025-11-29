import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
    title: string;
    value: string;
    icon: LucideIcon;
    trend?: number;
    trendDescription?: string;
    className?: string;
}

export function KPICard({
    title,
    value,
    icon: Icon,
    trend,
    trendDescription,
    className,
}: KPICardProps) {
    const isPositive = trend && trend > 0;

    return (
        <Card className={cn("overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow duration-200 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm", className)}>
            <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        {title}
                    </p>
                    <div className={cn("p-2 rounded-full bg-primary/10", isPositive ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10")}>
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
                <div className="flex items-baseline space-x-3">
                    <div className="text-2xl font-bold tracking-tight">{value}</div>
                    {trend && (
                        <div className={cn("flex items-center text-xs font-medium px-2 py-0.5 rounded-full",
                            isPositive ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" : "text-rose-700 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400"
                        )}>
                            {isPositive ? "+" : ""}{trend}%
                        </div>
                    )}
                </div>
                {trendDescription && (
                    <p className="text-xs text-muted-foreground mt-1">
                        {trendDescription}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
