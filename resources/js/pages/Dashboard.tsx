import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { KPICard } from '@/components/dashboard/kpi-card';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { IncomeExpenseChart } from '@/components/dashboard/income-expense-chart';
import { ProfitTrendChart } from '@/components/dashboard/profit-trend-chart';
import {
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
    TrendingDown,
    Euro,
    Calendar,
    Loader2,
    RefreshCw,
    FileText,
    Receipt,
    Users,
    Package,
    Wallet,
    Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    const [filter, setFilter] = useState('current_year');
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

        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        return {
            start_date: formatDate(start),
            end_date: formatDate(end),
            group_by: groupBy
        };
    };

    // Calculate previous period date range for delta comparison
    const getPreviousDateRange = (filterType: string) => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (filterType) {
            case 'current_month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'last_month':
                start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                end = new Date(now.getFullYear(), now.getMonth() - 1, 0);
                break;
            case 'current_year':
                start = new Date(now.getFullYear() - 1, 0, 1);
                end = new Date(now.getFullYear() - 1, 11, 31);
                break;
            case 'last_year':
                start = new Date(now.getFullYear() - 2, 0, 1);
                end = new Date(now.getFullYear() - 2, 11, 31);
                break;
        }

        const formatDate = (d: Date) => d.toISOString().split('T')[0];

        return {
            start_date: formatDate(start),
            end_date: formatDate(end),
        };
    };

    const dateRange = getDateRange(filter);
    const prevDateRange = getPreviousDateRange(filter);

    // Summary query for active period
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

    // Summary query for previous period (to calculate deltas)
    const { data: prevSummary } = useQuery<DashboardSummary>({
        queryKey: ['dashboard-summary-prev', filter],
        queryFn: async () => {
            const params = new URLSearchParams({
                start_date: prevDateRange.start_date,
                end_date: prevDateRange.end_date,
            });
            const { data } = await axios.get(`/api/dashboard/summary?${params}`);
            return data;
        },
    });

    // Chart query
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

    // Recent bookings query
    const { data: recentBookings } = useQuery({
        queryKey: ['recent-bookings'],
        queryFn: async () => {
            const { data } = await axios.get('/api/dashboard/recent-bookings?limit=5');
            return data;
        },
    });

    // Cost Centers query for selected date range (Top-Kostenstellen)
    const { data: costCentersReport, isLoading: isCostCentersLoading } = useQuery({
        queryKey: ['dashboard-cost-centers', filter],
        queryFn: async () => {
            const params = new URLSearchParams({
                from: dateRange.start_date,
                to: dateRange.end_date,
            });
            const { data } = await axios.get(`/api/reports/cost-centers?${params}`);
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

    // Delta math helper
    const getDelta = (currentValue?: number, previousValue?: number) => {
        if (currentValue === undefined || currentValue === null) return null;
        if (previousValue === undefined || previousValue === null) return null;
        if (previousValue === 0) {
            return currentValue > 0 ? 100 : (currentValue < 0 ? -100 : 0);
        }
        return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
    };

    const incomeDelta = summary && prevSummary ? getDelta(summary.income, prevSummary.income) : null;
    const expensesDelta = summary && prevSummary ? getDelta(summary.expenses, prevSummary.expenses) : null;
    const profitDelta = summary && prevSummary ? getDelta(summary.profit, prevSummary.profit) : null;

    const deltaDescription = filter.includes('year') ? "ggü. Vorjahr" : "ggü. Vormonat";

    // Sort cost centers by absolute saldo descending, slice top 5
    const topCostCenters = costCentersReport?.data
        ? [...costCentersReport.data]
            .sort((a: any, b: any) => b.balance - a.balance)
            .slice(0, 5)
        : [];

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
            queryClient.invalidateQueries({ queryKey: ['dashboard-summary-prev'] }),
            queryClient.invalidateQueries({ queryKey: ['dashboard-chart'] }),
            queryClient.invalidateQueries({ queryKey: ['recent-bookings'] }),
            queryClient.invalidateQueries({ queryKey: ['dashboard-cost-centers'] }),
            queryClient.invalidateQueries({ queryKey: ['contacts-count'] }),
            queryClient.invalidateQueries({ queryKey: ['products-count'] }),
            queryClient.invalidateQueries({ queryKey: ['open-invoices'] }),
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

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount / 100);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Dashboard</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Finanzübersicht und Kennzahlen
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Select value={filter} onValueChange={setFilter}>
                        <SelectTrigger className="flex-1 sm:w-[200px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                            <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                            <SelectValue placeholder="Zeitraum wählen" />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg">
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
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shrink-0 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                        disabled={isRefreshing}
                        title="Dashboard aktualisieren"
                    >
                        <RefreshCw className={`w-4 h-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Quick Actions & Quick Stats Cockpit section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick Actions */}
                <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 flex flex-col justify-between">
                    <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Schnellaktionen</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Häufig genutzte Aktionen direkt aufrufen</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        <Button asChild variant="default" className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm">
                            <Link to={`/${tenant}/bookings/create`}>
                                <Plus className="w-4 h-4 mr-2" /> Buchung
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="w-full border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg shadow-sm">
                            <Link to={`/${tenant}/invoices/create`}>
                                <FileText className="w-4 h-4 mr-2 text-slate-500" /> Rechnung
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="w-full border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg shadow-sm">
                            <Link to={`/${tenant}/belege/create`}>
                                <Receipt className="w-4 h-4 mr-2 text-slate-500" /> Beleg
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="w-full border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg shadow-sm">
                            <Link to={`/${tenant}/contacts`}>
                                <Users className="w-4 h-4 mr-2 text-slate-500" /> Kontakt
                            </Link>
                        </Button>
                    </div>
                </Card>

                {/* Quick Stats Grid */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl">
                        <CardContent className="p-5 flex items-center gap-4 h-full">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{contactsCount || 0}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kontakte</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl">
                        <CardContent className="p-5 flex items-center gap-4 h-full">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/30 flex items-center justify-center">
                                <Package className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{productsCount || 0}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Produkte</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl">
                        <CardContent className="p-5 flex items-center gap-4 h-full">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{openInvoicesData?.count || 0}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Offene Rechnungen</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl">
                        <CardContent className="p-5 flex items-center gap-4 h-full">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white truncate">
                                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format((openInvoicesData?.total || 0) / 100)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Offene Beträge</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {isSummaryLoading ? (
                    <>
                        <Card className="h-32 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm"><Loader2 className="animate-spin text-slate-400" /></Card>
                        <Card className="h-32 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm"><Loader2 className="animate-spin text-slate-400" /></Card>
                        <Card className="h-32 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm"><Loader2 className="animate-spin text-slate-400" /></Card>
                    </>
                ) : (
                    <>
                        <KPICard
                            title="Einnahmen"
                            value={summary?.income_formatted || '0,00 €'}
                            icon={TrendingUp}
                            delta={incomeDelta}
                            deltaDescription={deltaDescription}
                            className="border-slate-200/60 dark:border-slate-800 shadow-sm"
                        />
                        <KPICard
                            title="Ausgaben"
                            value={summary?.expenses_formatted || '0,00 €'}
                            icon={TrendingDown}
                            delta={expensesDelta}
                            deltaDescription={deltaDescription}
                            isExpense={true}
                            className="border-slate-200/60 dark:border-slate-800 shadow-sm"
                        />
                        <KPICard
                            title="Gewinn"
                            value={summary?.profit_formatted || '0,00 €'}
                            icon={Euro}
                            delta={profitDelta}
                            deltaDescription={deltaDescription}
                            className="border-slate-200/60 dark:border-slate-800 shadow-sm"
                        />
                    </>
                )}
            </div>

            {/* Diagramm-Grid (2 Spalten Desktop) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RevenueChart data={chartData} isLoading={isLoadingChart} />
                <IncomeExpenseChart data={chartData} isLoading={isLoadingChart} />
                <div className="lg:col-span-2">
                    <ProfitTrendChart data={chartData} isLoading={isLoadingChart} />
                </div>
            </div>

            {/* Kostenstellen-Übersicht + Letzte Buchungen */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Compact Cost Centers Card */}
                <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">Top-Kostenstellen</CardTitle>
                        <CardDescription>Erträge, Aufwendungen und Saldo nach Kostenstelle</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isCostCentersLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="animate-spin text-slate-400" />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {topCostCenters.map((cc: any) => {
                                    const isPositive = cc.balance >= 0;
                                    return (
                                        <Link
                                            key={cc.cost_center_id}
                                            to={`/${tenant}/cost-centers/${cc.cost_center_id}`}
                                            className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700"
                                            title={`Kostenstelle ${cc.name} Details öffnen`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 px-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-mono text-xs flex items-center justify-center font-bold">
                                                    {cc.code}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cc.name}</p>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                        Einnahmen: {formatCurrency(cc.revenue)} | Ausgaben: {formatCurrency(cc.cost)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={`text-sm font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {isPositive ? '+' : ''}
                                                {formatCurrency(cc.balance)}
                                            </div>
                                        </Link>
                                    );
                                })}
                                {(!topCostCenters || topCostCenters.length === 0) && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Keine Kostenstellen mit Buchungen im gewählten Zeitraum.</p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Letzte Buchungen */}
                <Card className="border border-slate-200/60 dark:border-slate-800 shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">Letzte Buchungen</CardTitle>
                        <CardDescription>Die neuesten Transaktionen</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {Array.isArray(recentBookings) && recentBookings.map((booking: any) => {
                                const isIncome = booking.lines?.some((l: any) => l.type === 'credit' && l.account?.type === 'revenue');
                                const isExpense = booking.lines?.some((l: any) => l.type === 'debit' && l.account?.type === 'expense');
                                const amount = calculateBookingAmount(booking);

                                return (
                                    <div key={booking.id} className="flex items-center p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 border border-transparent">
                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            isExpense ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                                                'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                            }`}>
                                            {isIncome ? <ArrowUpRight className="h-5 w-5" /> :
                                                isExpense ? <ArrowDownRight className="h-5 w-5" /> :
                                                    <Euro className="h-5 w-5" />}
                                        </div>
                                        <div className="ml-3 flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100">{booking.description}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {new Date(booking.booking_date).toLocaleDateString('de-DE')}
                                            </p>
                                        </div>
                                        <div className={`ml-auto font-bold ${isIncome ? 'text-emerald-600 dark:text-emerald-400' :
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
                            <Button variant="outline" className="w-full mt-4 rounded-lg shadow-sm border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                                Alle Buchungen anzeigen
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
