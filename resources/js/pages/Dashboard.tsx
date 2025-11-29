import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

    const { data: summary, isLoading: isLoadingSummary } = useQuery<DashboardSummary>({
        queryKey: ['dashboard-summary', filter],
        queryFn: async () => {
            const params = new URLSearchParams({
                start_date: dateRange.start_date,
                end_date: dateRange.end_date,
            });
            const res = await fetch(`/api/dashboard/summary?${params}`);
            return res.json();
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
            const res = await fetch(`/api/dashboard/chart?${params}`);
            return res.json();
        },
    });

    const { data: recentBookings } = useQuery({
        queryKey: ['recent-bookings'],
        queryFn: async () => {
            const res = await fetch('/api/dashboard/recent-bookings?limit=5');
            return res.json();
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

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                {isLoadingSummary ? (
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

            {/* Charts & Recent Activity */}
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-7">
                <div className="col-span-4">
                    <RevenueChart data={chartData} isLoading={isLoadingChart} />
                </div>

                <Card className="col-span-3 border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Letzte Buchungen</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {recentBookings?.map((booking: any) => {
                                const isIncome = booking.lines.some((l: any) => l.type === 'credit' && l.account.type === 'revenue');
                                const isExpense = booking.lines.some((l: any) => l.type === 'debit' && l.account.type === 'expense');
                                const amount = booking.amount / 100; // Assuming amount is stored in cents

                                return (
                                    <div key={booking.id} className="flex items-center">
                                        <div className={`h-9 w-9 rounded-full flex items-center justify-center border ${isIncome ? 'bg-emerald-100 border-emerald-200 text-emerald-600' :
                                            isExpense ? 'bg-rose-100 border-rose-200 text-rose-600' :
                                                'bg-slate-100 border-slate-200 text-slate-600'
                                            }`}>
                                            {isIncome ? <ArrowUpRight className="h-4 w-4" /> :
                                                isExpense ? <ArrowDownRight className="h-4 w-4" /> :
                                                    <Euro className="h-4 w-4" />}
                                        </div>
                                        <div className="ml-4 space-y-1">
                                            <p className="text-sm font-medium leading-none truncate max-w-[200px]">{booking.description}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(booking.booking_date).toLocaleDateString('de-DE')}
                                            </p>
                                        </div>
                                        <div className={`ml-auto font-medium ${isIncome ? 'text-emerald-600' :
                                            isExpense ? 'text-rose-600' : ''
                                            }`}>
                                            {isIncome ? '+' : isExpense ? '-' : ''}
                                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)}
                                        </div>
                                    </div>
                                );
                            })}
                            {(!recentBookings || recentBookings.length === 0) && (
                                <p className="text-sm text-slate-500 text-center py-4">Keine Buchungen gefunden.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
