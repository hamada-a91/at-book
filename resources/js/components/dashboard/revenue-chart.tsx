import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

interface ChartData {
    name: string;
    income: number;
    expense: number;
}

interface RevenueChartProps {
    data?: ChartData[];
    isLoading?: boolean;
}

export function RevenueChart({ data = [], isLoading = false }: RevenueChartProps) {
    return (
        <Card className="col-span-4 border-none shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-lg font-medium">Einnahmen & Ausgaben</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[350px] w-full">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            Lade Diagramm...
                        </div>
                    ) : data.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            Keine Daten für diesen Zeitraum verfügbar.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="name"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `€${value}`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ stroke: '#8884d8', strokeWidth: 1 }}
                                    formatter={(value: number) => [`€${value.toFixed(2)}`, '']}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="income"
                                    name="Einnahmen"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorIncome)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="expense"
                                    name="Ausgaben"
                                    stroke="#f43f5e"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorExpense)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
