import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { KPICard } from '@/components/dashboard/kpi-card';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import {
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
    TrendingDown,
    Euro,
    Calendar,
    Loader2,
    RefreshCw,
    Plus,
    FileText,
    Receipt,
    Users,
    Package,
    PieChart,
    BarChart3,
    Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import axios from '@/lib/axios';

interface DashboardSummary {
    income: number;
    income_formatted: string;
    expenses: number;
    expenses_formatted: string;
    profit: number;
    profit_formatted: string;
    period: {
        start: string;
        end: string;
    };
}

interface ChartData {
    name: string;
    income: number;
    expense: number;
}

export function Dashboard() {
    const [filter, setFilter] = useState('current_month');
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { tenant } = useParams();

    // Calculate date range based on filter
    const getDateRange = (filterType: string) => {
        const now = new Date();
        let start = new Date();
        let end = new Date();
        let groupBy = 'day';

        switch (filterType) {
            case 'current_month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                groupBy = 'day';
                break;
            case 'last_month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                groupBy = 'day';
                break;
            case 'current_year':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
                groupBy = 'month';
                break;
            case 'last_year':
                start = new Date(now.getFullYear() - 1, 0, 1);
                end = new Date(now.getFullYear() - 1, 11, 31);
                groupBy = 'month';
                break;
        }

        // Format as YYYY-MM-DD
        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        return {
            start_date: formatDate(start),
            end_date: formatDate(end),
            group_by: groupBy
        };
    };

    const dateRange = getDateRange(filter);

    const { data: summary, isLoading: isSummaryLoading } = useQuery<DashboardSummary>({
        queryKey: ['dashboard-summary', filter],
        queryFn: async () => {
            const params = new URLSearchParams({
                start_date: dateRange.start_date,
                end_date: dateRange.end_date,
            });
            const { data } = await axios.get(`/api/dashboard/summary?${params}`);
            return data;
        },
    });

    const { data: chartData, isLoading: isLoadingChart } = useQuery<ChartData[]>({
        queryKey: ['dashboard-chart', filter],
        queryFn: async () => {
            const params = new URLSearchParams({
                start_date: dateRange.start_date,
                end_date: dateRange.end_date,
                group_by: dateRange.group_by,
            });
            const { data } = await axios.get(`/api/dashboard/chart?${params}`);
            return data;
        },
    });

    const { data: recentBookings } = useQuery({
        queryKey: ['recent-bookings'],
        queryFn: async () => {
            const { data } = await axios.get('/api/dashboard/recent-bookings?limit=5');
            return data;
        },
    });

    // Fetch counts for quick stats
    const { data: contactsCount } = useQuery({
        queryKey: ['contacts-count'],
        queryFn: async () => {
            const { data } = await axios.get('/api/contacts');
            return Array.isArray(data) ? data.length : 0;
        },
    });

    const { data: productsCount } = useQuery({
        queryKey: ['products-count'],
        queryFn: async () => {
            const { data } = await axios.get('/api/products');
            return Array.isArray(data) ? data.length : 0;
        },
    });

    const { data: openInvoicesData } = useQuery({
        queryKey: ['open-invoices'],
        queryFn: async () => {
            const { data } = await axios.get('/api/invoices?status=sent');
            const invoices = Array.isArray(data) ? data : (data?.data || []);
            const total = invoices.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
            return { count: invoices.length, total };
        },
    });

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
            queryClient.invalidateQueries({ queryKey: ['dashboard-chart'] }),
            queryClient.invalidateQueries({ queryKey: ['recent-bookings'] }),
        ]);
        setTimeout(() => setIsRefreshing(false), 500);
    };

    // Calculate amount from booking lines
    const calculateBookingAmount = (booking: any) => {
        if (!booking.lines || booking.lines.length === 0) return 0;
        const totalDebit = booking.lines
            .filter((l: any) => l.type === 'debit')
            .reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
        return totalDebit / 100;
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Dashboard</h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        Finanzübersicht und Kennzahlen
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={filter} onValueChange={setFilter}>
                        <SelectTrigger className="w-[180px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                            <Calendar className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Zeitraum wählen" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="current_month">Aktueller Monat</SelectItem>
                            <SelectItem value="last_month">Letzter Monat</SelectItem>
                            <SelectItem value="current_year">Aktuelles Jahr</SelectItem>
                            <SelectItem value="last_year">Letztes Jahr</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleRefresh}
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Quick Actions - Modern Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Link to={`/${tenant}/bookings/create`} className="group">
                    <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 cursor-pointer transform hover:scale-[1.02]">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Receipt className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-white/80 text-sm font-medium">Neu</p>
                                <p className="text-white font-bold text-lg">Buchung</p>
                            </div>
                            <Plus className="w-5 h-5 text-white/60 ml-auto group-hover:rotate-90 transition-transform duration-300" />
                        </CardContent>
                    </Card>
                </Link>
                <Link to={`/${tenant}/invoices/create`} className="group">
                    <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 cursor-pointer transform hover:scale-[1.02]">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-white/80 text-sm font-medium">Neu</p>
                                <p className="text-white font-bold text-lg">Rechnung</p>
                            </div>
                            <Plus className="w-5 h-5 text-white/60 ml-auto group-hover:rotate-90 transition-transform duration-300" />
                        </CardContent>
                    </Card>
                </Link>
                <Link to={`/${tenant}/belege/create`} className="group">
                    <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 transition-all duration-300 cursor-pointer transform hover:scale-[1.02]">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Receipt className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-white/80 text-sm font-medium">Neu</p>
                                <p className="text-white font-bold text-lg">Beleg</p>
                            </div>
                            <Plus className="w-5 h-5 text-white/60 ml-auto group-hover:rotate-90 transition-transform duration-300" />
                        </CardContent>
                    </Card>
                </Link>
                <Link to={`/${tenant}/contacts`} className="group">
                    <Card className="border-none shadow-lg bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 transition-all duration-300 cursor-pointer transform hover:scale-[1.02]">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-white/80 text-sm font-medium">Neu</p>
                                <p className="text-white font-bold text-lg">Kontakt</p>
                            </div>
                            <Plus className="w-5 h-5 text-white/60 ml-auto group-hover:rotate-90 transition-transform duration-300" />
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                {isSummaryLoading ? (
                    <>
                        <Card className="h-32 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"><Loader2 className="animate-spin text-slate-400" /></Card>
                        <Card className="h-32 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"><Loader2 className="animate-spin text-slate-400" /></Card>
                        <Card className="h-32 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"><Loader2 className="animate-spin text-slate-400" /></Card>
                    </>
                ) : (
                    <>
                        <KPICard
                            title="Einnahmen"
                            value={summary?.income_formatted || '0,00 €'}
                            icon={TrendingUp}
                            trend={0}
                            trendDescription="im gewählten Zeitraum"
                            className="text-emerald-600"
                        />
                        <KPICard
                            title="Ausgaben"
                            value={summary?.expenses_formatted || '0,00 €'}
                            icon={TrendingDown}
                            trend={0}
                            trendDescription="im gewählten Zeitraum"
                            className="text-rose-600"
                        />
                        <KPICard
                            title="Gewinn / Verlust"
                            value={summary?.profit_formatted || '0,00 €'}
                            icon={Euro}
                            trend={0}
                            trendDescription="Differenz (Einnahmen - Ausgaben)"
                            className={summary?.profit && summary.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}
                        />
                    </>
                )}
            </div>

            {/* Quick Stats Row */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-none shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{contactsCount || 0}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Kontakte</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{productsCount || 0}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Produkte</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{openInvoicesData?.count || 0}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Offene Rechnungen</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white/80 dark:bg-slate-900/80 backdrop-blur">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format((openInvoicesData?.total || 0) / 100)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Offene Beträge</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts & Recent Activity */}
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-7">
                <div className="col-span-4">
                    <RevenueChart data={chartData} isLoading={isLoadingChart} />
                </div>

                <Card className="col-span-3 border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Letzte Buchungen</CardTitle>
                        <CardDescription>Die neuesten Transaktionen</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {Array.isArray(recentBookings) && recentBookings.map((booking: any) => {
                                const isIncome = booking.lines?.some((l: any) => l.type === 'credit' && l.account?.type === 'revenue');
                                const isExpense = booking.lines?.some((l: any) => l.type === 'debit' && l.account?.type === 'expense');
                                const amount = calculateBookingAmount(booking);

                                return (
                                    <div key={booking.id} className="flex items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isIncome ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            isExpense ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                                                'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                            }`}>
                                            {isIncome ? <ArrowUpRight className="h-5 w-5" /> :
                                                isExpense ? <ArrowDownRight className="h-5 w-5" /> :
                                                    <Euro className="h-5 w-5" />}
                                        </div>
                                        <div className="ml-3 flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">{booking.description}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {new Date(booking.booking_date).toLocaleDateString('de-DE')}
                                            </p>
                                        </div>
                                        <div className={`ml-auto font-semibold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' :
                                            isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                                            }`}>
                                            {isIncome ? '+' : isExpense ? '-' : ''}
                                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)}
                                        </div>
                                    </div>
                                );
                            })}
                            {(!recentBookings || recentBookings.length === 0) && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Keine Buchungen gefunden.</p>
                            )}
                        </div>
                        <Link to={`/${tenant}/bookings`}>
                            <Button variant="outline" className="w-full mt-4">
                                Alle Buchungen anzeigen
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
