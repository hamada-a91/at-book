import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
    title: string;
    value: number | string;
    icon: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    subtitle?: string;
    colorScheme?: 'blue' | 'green' | 'purple' | 'amber';
}

const colorSchemes = {
    blue: {
        bg: 'bg-blue-50',
        icon: 'bg-blue-600',
        text: 'text-blue-700',
        trend: 'text-blue-600',
    },
    green: {
        bg: 'bg-green-50',
        icon: 'bg-green-600',
        text: 'text-green-700',
        trend: 'text-green-600',
    },
    purple: {
        bg: 'bg-purple-50',
        icon: 'bg-purple-600',
        text: 'text-purple-700',
        trend: 'text-purple-600',
    },
    amber: {
        bg: 'bg-amber-50',
        icon: 'bg-amber-600',
        text: 'text-amber-700',
        trend: 'text-amber-600',
    },
};

export function StatCard({
    title,
    value,
    icon: Icon,
    trend,
    subtitle,
    colorScheme = 'blue',
}: StatCardProps) {
    const colors = colorSchemes[colorScheme];

    return (
        <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-0">
                <div className="flex items-center">
                    {/* Icon Section */}
                    <div className={`${colors.bg} p-6 flex items-center justify-center`}>
                        <div className={`${colors.icon} w-12 h-12 rounded-lg flex items-center justify-center shadow-md`}>
                            <Icon className="w-6 h-6 text-white" />
                        </div>
                    </div>

                    {/* Stats Section */}
                    <div className="flex-1 p-6">
                        <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
                        <div className="flex items-baseline space-x-2">
                            <p className="text-3xl font-bold text-slate-900">{value.toLocaleString('de-DE')}</p>
                            {trend && (
                                <span
                                    className={`text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'
                                        }`}
                                >
                                    {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                                </span>
                            )}
                        </div>
                        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
