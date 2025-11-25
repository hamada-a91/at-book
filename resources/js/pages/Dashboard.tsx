import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Users, BookOpen, PlusCircle, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { Navigation } from '@/components/Layout/Navigation';
import { StatCard } from '@/components/Dashboard/StatCard';
import { QuickActionCard } from '@/components/Dashboard/QuickActionCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface JournalEntry {
    id: number;
    booking_date: string;
    description: string;
    status: string;
}

export function Dashboard() {
    const { data: accounts } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => {
            const res = await fetch('/api/accounts');
            return res.json();
        },
    });

    const { data: bookingsData } = useQuery<{ data: JournalEntry[] }>({
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

    const bookings = bookingsData?.data || [];
    const recentBookings = bookings.slice(0, 5);

    // Calculate draft vs posted ratio
    const draftCount = bookings.filter((b) => b.status === 'draft').length;
    const postedCount = bookings.filter((b) => b.status === 'posted').length;

    const quickActions = [
        {
            title: 'Neue Buchung',
            description: 'Buchungssatz erfassen',
            href: '/bookings/create',
            icon: PlusCircle,
            colorScheme: 'blue' as const,
        },
        {
            title: 'Kontenplan',
            description: 'SKR03 Konten verwalten',
            href: '/accounts',
            icon: FileText,
            colorScheme: 'green' as const,
        },
        {
            title: 'Journal',
            description: 'Alle Buchungen anzeigen',
            href: '/bookings',
            icon: BookOpen,
            colorScheme: 'purple' as const,
        },
        {
            title: 'Kontakte',
            description: 'Kunden und Lieferanten',
            href: '/contacts',
            icon: Users,
            colorScheme: 'amber' as const,
        },
    ];

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const statusConfig = {
        draft: { label: 'Entwurf', color: 'bg-yellow-100 text-yellow-700' },
        posted: { label: 'Gebucht', color: 'bg-green-100 text-green-700' },
        cancelled: { label: 'Storniert', color: 'bg-red-100 text-red-700' },
    };

    return (
        <Navigation>
            {/* Welcome Section */}
            <div className="mb-10">
                <h1 className="text-5xl font-bold text-slate-900 mb-2">Willkommen zurück!</h1>
                <p className="text-xl text-slate-600">
                    Hier ist eine Übersicht Ihrer Buchhaltung
                </p>
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <StatCard
                    title="Konten"
                    value={accounts?.length || 0}
                    icon={FileText}
                    colorScheme="blue"
                    subtitle="SKR03 Kontenplan"
                />
                <StatCard
                    title="Buchungen"
                    value={bookings.length || 0}
                    icon={BookOpen}
                    colorScheme="green"
                    subtitle={draftCount > 0 ? `${draftCount} Entwürfe` : 'Alle gebucht'}
                />
                <StatCard
                    title="Kontakte"
                    value={contacts?.length || 0}
                    icon={Users}
                    colorScheme="purple"
                    subtitle="Kunden & Lieferanten"
                />
            </div>

            {/* Quick Actions Grid */}
            <div className="mb-10">
                <h2 className="text-2xl font-semibold text-slate-900 mb-6">Schnellzugriff</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {quickActions.map((action) => (
                        <QuickActionCard key={action.title} {...action} />
                    ))}
                </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Bookings */}
                <Card className="shadow-lg">
                    <CardHeader className="border-b border-slate-100">
                        <CardTitle className="flex items-center space-x-2">
                            <Clock className="w-5 h-5 text-slate-600" />
                            <span>Letzte Buchungen</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentBookings.length === 0 ? (
                            <div className="p-8 text-center">
                                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500 mb-4">Noch keine Buchungen vorhanden</p>
                                <Link
                                    to="/bookings/create"
                                    className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    Erste Buchung erstellen
                                    <PlusCircle className="w-4 h-4 ml-2" />
                                </Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {recentBookings.map((booking) => (
                                    <Link
                                        key={booking.id}
                                        to={`/bookings`}
                                        className="block p-4 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <p className="font-medium text-slate-900 mb-1">
                                                    {booking.description}
                                                </p>
                                                <p className="text-sm text-slate-500">
                                                    {formatDate(booking.booking_date)}
                                                </p>
                                            </div>
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig[booking.status as keyof typeof statusConfig]?.color ||
                                                    'bg-slate-100 text-slate-700'
                                                    }`}
                                            >
                                                {statusConfig[booking.status as keyof typeof statusConfig]?.label ||
                                                    booking.status}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                        {recentBookings.length > 0 && (
                            <div className="p-4 border-t border-slate-100">
                                <Link
                                    to="/bookings"
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    Alle Buchungen anzeigen →
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* System Status */}
                <Card className="shadow-lg">
                    <CardHeader className="border-b border-slate-100">
                        <CardTitle className="flex items-center space-x-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <span>System-Status</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">GoBD-Konformität</span>
                                <span className="flex items-center text-sm font-medium text-green-600">
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Aktiv
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Offene Entwürfe</span>
                                <span className="text-sm font-semibold text-slate-900">
                                    {draftCount}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Gebuchte Einträge</span>
                                <span className="text-sm font-semibold text-slate-900">
                                    {postedCount}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600">Letzte Aktivität</span>
                                <span className="text-sm text-slate-600">
                                    {recentBookings.length > 0
                                        ? formatDate(recentBookings[0].booking_date)
                                        : 'Keine Aktivität'}
                                </span>
                            </div>
                        </div>

                        {draftCount > 0 && (
                            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800 mb-2">
                                    <strong>{draftCount} Entwürfe</strong> warten auf Buchung
                                </p>
                                <Link
                                    to="/bookings"
                                    className="text-sm text-yellow-700 hover:text-yellow-900 font-medium"
                                >
                                    Jetzt buchen →
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </Navigation>
    );
}
