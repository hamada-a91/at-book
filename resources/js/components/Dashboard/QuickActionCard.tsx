import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface QuickActionCardProps {
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
    colorScheme?: 'blue' | 'green' | 'purple' | 'amber';
}

const colorSchemes = {
    blue: {
        card: 'border-blue-200 hover:border-blue-300 hover:shadow-blue-100',
        bg: 'bg-blue-50 group-hover:bg-blue-100',


        icon: 'text-blue-600',
        arrow: 'text-blue-600 group-hover:translate-x-1',
    },
    green: {
        card: 'border-green-200 hover:border-green-300 hover:shadow-green-100',
        bg: 'bg-green-50 group-hover:bg-green-100',
        icon: 'text-green-600',
        arrow: 'text-green-600 group-hover:translate-x-1',
    },
    purple: {
        card: 'border-purple-200 hover:border-purple-300 hover:shadow-purple-100',
        bg: 'bg-purple-50 group-hover:bg-purple-100',
        icon: 'text-purple-600',
        arrow: 'text-purple-600 group-hover:translate-x-1',
    },
    amber: {
        card: 'border-amber-200 hover:border-amber-300 hover:shadow-amber-100',
        bg: 'bg-amber-50 group-hover:bg-amber-100',
        icon: 'text-amber-600',
        arrow: 'text-amber-600 group-hover:translate-x-1',
    },
};

export function QuickActionCard({
    title,
    description,
    href,
    icon: Icon,
    colorScheme = 'blue',
}: QuickActionCardProps) {
    const colors = colorSchemes[colorScheme];

    return (
        <Link to={href} className="group">
            <Card className={`border-2 ${colors.card} transition-all duration-200 hover:shadow-lg`}>
                <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className={`${colors.bg} w-12 h-12 rounded-lg flex items-center justify-center transition-colors duration-200`}>
                            <Icon className={`w-6 h-6 ${colors.icon}`} />
                        </div>
                        <ArrowRight className={`w-5 h-5 ${colors.arrow} transition-transform duration-200`} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
                    <p className="text-sm text-slate-600">{description}</p>
                </CardContent>
            </Card>
        </Link>
    );
}
