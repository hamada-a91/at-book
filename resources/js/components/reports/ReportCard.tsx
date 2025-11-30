import { LucideIcon, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReportCardProps {
    title: string;
    description: string;
    icon: LucideIcon;
    onClick: () => void;
    isLoading?: boolean;
    className?: string;
    color?: string;
}

export function ReportCard({
    title,
    description,
    icon: Icon,
    onClick,
    isLoading,
    className,
    color = "text-primary"
}: ReportCardProps) {
    return (
        <Card className={cn(
            "group hover:shadow-lg transition-all duration-300 border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm cursor-pointer",
            className
        )} onClick={onClick}>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className={cn("p-2 rounded-lg bg-slate-100 dark:bg-slate-800", color.replace('text-', 'bg-').replace('600', '100').replace('500', '100'))}>
                        <Icon className={cn("w-6 h-6", color)} />
                    </div>
                </div>
                <CardTitle className="mt-4 text-xl group-hover:text-primary transition-colors">
                    {title}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                    {description}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button
                    variant="ghost"
                    className="w-full justify-between group-hover:bg-primary group-hover:text-white transition-colors"
                    disabled={isLoading}
                >
                    {isLoading ? 'Wird erstellt...' : 'Bericht erstellen'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </CardContent>
        </Card>
    );
}
