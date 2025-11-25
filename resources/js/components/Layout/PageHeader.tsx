import React from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    action?: {
        label: string;
        icon?: LucideIcon;
        onClick?: () => void;
        href?: string;
    };
    stats?: Array<{
        label: string;
        value: string | number;
    }>;
}

export function PageHeader({ title, subtitle, action, stats }: PageHeaderProps) {
    const ActionIcon = action?.icon;

    return (
        <div className="mb-8">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <h1 className="text-4xl font-bold text-slate-900 mb-2">{title}</h1>
                    {subtitle && <p className="text-lg text-slate-600">{subtitle}</p>}

                    {/* Inline Stats */}
                    {stats && stats.length > 0 && (
                        <div className="flex items-center space-x-6 mt-4">
                            {stats.map((stat, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                    <span className="text-sm text-slate-500">{stat.label}:</span>
                                    <span className="text-sm font-semibold text-slate-900">
                                        {typeof stat.value === 'number' ? stat.value.toLocaleString('de-DE') : stat.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Action Button */}
                {action && (
                    <div className="flex-shrink-0 ml-4">
                        {action.href ? (
                            <a href={action.href}>
                                <Button size="lg" className="shadow-md hover:shadow-lg transition-shadow">
                                    {ActionIcon && <ActionIcon className="w-5 h-5 mr-2" />}
                                    {action.label}
                                </Button>
                            </a>
                        ) : (
                            <Button
                                size="lg"
                                onClick={action.onClick}
                                className="shadow-md hover:shadow-lg transition-shadow"
                            >
                                {ActionIcon && <ActionIcon className="w-5 h-5 mr-2" />}
                                {action.label}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="mt-6 border-b border-slate-200"></div>
        </div>
    );
}
