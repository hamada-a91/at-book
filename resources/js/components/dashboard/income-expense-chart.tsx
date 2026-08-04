import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useEffect, useState } from "react";

interface ChartData {
    name: string;
    income: number;
    expense: number;
}

interface IncomeExpenseChartProps {
    data?: ChartData[];
    isLoading?: boolean;
}

export function IncomeExpenseChart({ data = [], isLoading = false }: IncomeExpenseChartProps) {
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

    return (
        <Card className="border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-lg font-medium text-slate-900 dark:text-slate-100">Vergleich: Einnahmen vs. Ausgaben</CardTitle>
            </CardHeader>
            <CardContent className="pl-0 md:pl-2">
                <div className="h-[250px] md:h-[350px] w-full">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                            Lade Diagramm...
                        </div>
                    ) : data.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                            Keine Daten für diesen Zeitraum verfügbar.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                                    formatter={(value: number) => [`€${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '']}
                                />
                                <Legend wrapperStyle={{ color: textColor }} />
                                <Bar
                                    dataKey="income"
                                    name="Einnahmen"
                                    fill="#10b981"
                                    radius={[4, 4, 0, 0]}
                                />
                                <Bar
                                    dataKey="expense"
                                    name="Ausgaben"
                                    fill="#f43f5e"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
