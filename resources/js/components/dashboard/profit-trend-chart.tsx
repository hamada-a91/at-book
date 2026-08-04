import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { useEffect, useState } from "react";

interface ChartData {
    name: string;
    income: number;
    expense: number;
}

interface ProfitTrendChartProps {
    data?: ChartData[];
    isLoading?: boolean;
}

export function ProfitTrendChart({ data = [], isLoading = false }: ProfitTrendChartProps) {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const checkDarkMode = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const gridColor = isDark ? '#334155' : '#e5e7eb';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const tooltipBg = isDark ? '#1e293b' : '#ffffff';
    const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

    const processedData = data.map(item => ({
        name: item.name,
        profit: item.income - item.expense
    }));

    // Calculate dynamic gradient split offset at y = 0
    const values = processedData.map(d => d.profit);
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const range = max - min;
    const off = range > 0 ? max / range : 0.5;

    return (
        <Card className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-lg font-medium text-slate-900 dark:text-slate-100">Ergebnis-Verlauf (Gewinn/Verlust)</CardTitle>
            </CardHeader>
            <CardContent className="pl-0 md:pl-2">
                <div className="h-[250px] md:h-[350px] w-full">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                            Lade Diagramm...
                        </div>
                    ) : processedData.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                            Keine Daten für diesen Zeitraum verfügbar.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={processedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset={off} stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset={off} stopColor="#f43f5e" stopOpacity={0.3} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                <XAxis
                                    dataKey="name"
                                    stroke={textColor}
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke={textColor}
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `€${value.toLocaleString('de-DE')}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '8px',
                                        border: `1px solid ${tooltipBorder}`,
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        backgroundColor: tooltipBg,
                                        color: textColor
                                    }}
                                    cursor={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1 }}
                                    formatter={(value: number) => [`€${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '']}
                                />
                                <Legend wrapperStyle={{ color: textColor }} />
                                <ReferenceLine y={0} stroke={isDark ? '#64748b' : '#94a3b8'} strokeWidth={1.5} />
                                <Area
                                    type="monotone"
                                    dataKey="profit"
                                    name="Gewinn / Verlust"
                                    stroke={isDark ? '#475569' : '#cbd5e1'}
                                    strokeWidth={2}
                                    fill="url(#splitColor)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
