import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Users, BookOpen, PlusCircle, TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle2, Calendar, BarChart3 } from 'lucide-react';
import { Navigation } from '@/components/Layout/Navigation';
import { StatCard } from '@/components/Dashboard/StatCard';
import { QuickActionCard } from '@/components/Dashboard/QuickActionCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface JournalEntry {
    id: number;
    booking_date: string;
    description: string;
    status: string;
}

interface DashboardSummary {
    income: number;
    income_formatted: string;
    expenses: number;
    expenses_formatted: string;
    profit: number;
    profit_formatted: string;
}

export function Dashboard() {
    const [period, setPeriod] = useState<string>('current_month');
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

    // Dashboard summary with period filtering
    const { data: summary, isLoading: summaryLoading } = useQuery<DashboardSummary>({
        queryKey: ['dashboard-summary', period],
        queryFn: async () => {
            const params = getPeriodParams(period);
            const res = await fetch(`/api/dashboard/summary?start_date=${params.startDate}&end_date=${params.endDate}`);
            return res.json();
        },
    });

    // Helper function to get date range for selected period
    function getPeriodParams(periodValue: string) {
        const now = new Date();
        let startDate, endDate;

        switch (periodValue) {
            case 'current_month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'previous_month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'current_year':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
                break;
            case 'previous_year':
                startDate = new Date(now.getFullYear() - 1, 0, 1);
                endDate = new Date(now.getFullYear() - 1, 11, 31);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        };
    }

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

            {/* Period Selector */}
            <div className="mb-8">
                <Card className="shadow-md">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <Calendar className="h-5 w-5 text-slate-600" />
                            <span className="text-sm font-medium text-slate-700">Zeitraum:</span>
                            <Select value={period} onValueChange={setPeriod}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="current_month">Dieser Monat</SelectItem>
                                    <SelectItem value="previous_month">Vormonat</SelectItem>
                                    <SelectItem value="current_year">Dieses Jahr</SelectItem>
                                    <SelectItem value="previous_year">Vorjahr</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Financial KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <Card className="shadow-lg border-t-4 border-green-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Einnahmen</CardTitle>
                        <TrendingUp className="h-5 w-5 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        {summaryLoading ? (
                            <div className="h-8 bg-slate-200 animate-pulse rounded" />
                        ) : (
                            <>
                                <div className="text-3xl font-bold text-green-600">
                                    {summary?.income_formatted || '0,00 €'}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Erlöse</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-t-4 border-red-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Ausgaben</CardTitle>
                        <TrendingDown className="h-5 w-5 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        {summaryLoading ? (
                            <div className="h-8 bg-slate-200 animate-pulse rounded" />
                        ) : (
                            <>
                                <div className="text-3xl font-bold text-red-600">
                                    {summary?.expenses_formatted || '0,00 €'}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Kosten</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className={`shadow-lg border-t-4 ${(summary?.profit ?? 0) >= 0 ? 'border-blue-500' : 'border-orange-500'}`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Gewinn / Verlust</CardTitle>
                        <DollarSign className={`h-5 w-5 ${(summary?.profit ?? 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                    </CardHeader>
                    <CardContent>
                        {summaryLoading ? (
                            <div className="h-8 bg-slate-200 animate-pulse rounded" />
                        ) : (
                            <>
                                <div className={`text-3xl font-bold ${(summary?.profit ?? 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                                    {summary?.profit_formatted || '0,00 €'}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    {(summary?.profit ?? 0) >= 0 ? 'Gewinn' : 'Verlust'}
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
                {/* Profit Bar Chart */}
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-slate-600" />
                            Gewinn-Übersicht
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg">
                            <div className="text-center">
                                <div className="space-y-4">
                                    <div className="flex justify-center gap-8">
                                        <div className="text-center">
                                            <div className="text-sm text-slate-600 mb-1">Einnahmen</div>
                                            <div className="h-32 w-20 bg-green-500 rounded-t-lg flex items-end justify-center pb-2 text-white font-semibold"
                                                style={{ height: `${Math.min(((summary?.income ?? 0) / Math.max((summary?.income ?? 1), (summary?.expenses ?? 1))) * 200, 200)}px` }}>
                                                {summary?.income ? `${((summary.income / 100).toFixed(0))}€` : '0'}
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-sm text-slate-600 mb-1">Ausgaben</div>
                                            <div className="h-32 w-20 bg-red-500 rounded-t-lg flex items-end justify-center pb-2 text-white font-semibold"
                                                style={{ height: `${Math.min(((summary?.expenses ?? 0) / Math.max((summary?.income ?? 1), (summary?.expenses ?? 1))) * 200, 200)}px` }}>
                                                {summary?.expenses ? `${((summary.expenses / 100).toFixed(0))}€` : '0'}
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-sm text-slate-600 mb-1">Gewinn</div>
                                            <div className={`h-32 w-20 rounded-t-lg flex items-end justify-center pb-2 text-white font-semibold ${(summary?.profit ?? 0) >= 0 ? 'bg-blue-500' : 'bg-orange-500'}`}
                                                style={{ height: `${Math.min((Math.abs(summary?.profit ?? 0) / Math.max((summary?.income ?? 1), (summary?.expenses ?? 1))) * 200, 200)}px` }}>
                                                {summary?.profit ? `${((summary.profit / 100).toFixed(0))}€` : '0'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Trend Line Chart */}
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-slate-600" />
                            Trend-Übersicht
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4">
                            <div className="h-full flex flex-col">
                                {/* Y-Axis Labels */}
                                <div className="flex-1 flex">
                                    <div className="w-12 flex flex-col justify-between text-xs text-slate-600 pr-2">
                                        <div>{Math.round((Math.max(summary?.income ?? 0, summary?.expenses ?? 0) / 100))}</div>
                                        <div>{Math.round((Math.max(summary?.income ?? 0, summary?.expenses ?? 0) / 200))}</div>
                                        <div>0</div>
                                    </div>
                                    <div className="flex-1 relative border-l border-b border-slate-300">
                                        {/* Grid lines */}
                                        <div className="absolute inset-0 flex flex-col justify-between">
                                            <div className="border-t border-slate-200"></div>
                                            <div className="border-t border-slate-200"></div>
                                            <div className="border-t border-slate-200"></div>
                                        </div>
                                        {/* Simple trend visualization */}
                                        <div className="absolute inset-0 flex items-end justify-around pb-2 px-4">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                                <div className={`w-2 h-2 rounded-full ${(summary?.profit ?? 0) >= 0 ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                                            </div>
                                            <div className="h-full border-l-2 border-dashed border-slate-300"></div>
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                                <div className={`w-2 h-2 rounded-full ${(summary?.profit ?? 0) >= 0 ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* X-Axis Labels */}
                                <div className="flex justify-between text-xs text-slate-600 ml-12 mt-2">
                                    <div>Start</div>
                                    <div>Ende</div>
                                </div>
                                {/* Legend */}
                                <div className="flex justify-center gap-4 mt-3 text-xs">
                                    <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                        <span>Einnahmen</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                        <span>Ausgaben</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className={`w-3 h-3 rounded-full ${(summary?.profit ?? 0) >= 0 ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                                        <span>Gewinn</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
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
