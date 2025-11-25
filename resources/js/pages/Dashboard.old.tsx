import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Users, BookOpen, PlusCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Stats {
    accounts: number;
    bookings: number;
    contacts: number;
}

export function Dashboard() {
    const { data: accounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => {
            const res = await fetch('/api/accounts');
            return res.json();
        },
    });

    const { data: bookings } = useQuery({
        queryKey: ['bookings'],
        queryFn: async () => {
            const res = await fetch('/api/bookings');
            return res.json();
        },
    });

    const { data: contacts } = useQuery({
        queryKey: ['contacts'],
        queryFn: async () => {
            const res = await fetch('/api/contacts');
            return res.json();
        },
    });

    const stats = [
        { title: 'Konten', value: accounts?.length || 0, icon: FileText, color: 'text-blue-600' },
        { title: 'Buchungen', value: bookings?.length || 0, icon: BookOpen, color: 'text-green-600' },
        { title: 'Kontakte', value: contacts?.length || 0, icon: Users, color: 'text-purple-600' },
    ];

    const quickActions = [
        {
            title: 'Neue Buchung',
            description: 'Buchungssatz erstellen',
            href: '/bookings/create',
            icon: PlusCircle,
            color: 'border-blue-200 hover:bg-blue-50',
        },
        {
            title: 'Kontenplan',
            description: 'SKR03 Konten verwalten',
            href: '/accounts',
            icon: FileText,
            color: 'border-green-200 hover:bg-green-50',
        },
        {
            title: 'Journal',
            description: 'Alle Buchungen anzeigen',
            href: '/bookings',
            icon: BookOpen,
            color: 'border-purple-200 hover:bg-purple-50',
        },
        {
            title: 'Kontakte verwalten',
            description: 'Kunden und Lieferanten',
            href: '/contacts',
            icon: Users,
            color: 'border-orange-200 hover:bg-orange-50',
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="container mx-auto py-8 px-4">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-5xl font-bold text-slate-900 mb-2">AT-Book</h1>
                    <p className="text-xl text-slate-600">GoBD-konforme Buchhaltung</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {stats.map((stat) => (
                        <Card key={stat.title} className="shadow-lg hover:shadow-xl transition">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-600 mb-1">{stat.title}</p>
                                        <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                                    </div>
                                    <stat.icon className={`w-12 h-12 ${stat.color}`} />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Quick Actions */}
                <Card className="shadow-lg mb-8">
                    <CardHeader>
                        <CardTitle className="text-2xl">Schnellzugriff</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {quickActions.map((action) => (
                                <Link
                                    key={action.title}
                                    to={action.href}
                                    className={`flex items-center p-4 border-2 rounded-lg transition ${action.color}`}
                                >
                                    <div className={`p-3 rounded-full mr-4 ${action.color.replace('border-', 'bg-').replace('hover:bg-', 'bg-')}`}>
                                        <action.icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900">{action.title}</h3>
                                        <p className="text-sm text-slate-600">{action.description}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
