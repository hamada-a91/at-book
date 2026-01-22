import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DateRangeSelectorProps {
    onRangeChange: (from: Date, to: Date) => void;
    className?: string;
}

export function DateRangeSelector({ onRangeChange, className }: DateRangeSelectorProps) {
    const [fromDate, setFromDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [toDate, setToDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [activePreset, setActivePreset] = useState<string>('thisMonth');

    useEffect(() => {
        if (fromDate && toDate) {
            onRangeChange(new Date(fromDate), new Date(toDate));
        }
    }, [fromDate, toDate]);

    const presets = [
        {
            label: 'Diesen Monat',
            value: 'thisMonth',
            range: () => ({
                from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                to: format(endOfMonth(new Date()), 'yyyy-MM-dd')
            }),
        },
        {
            label: 'Letzten Monat',
            value: 'lastMonth',
            range: () => {
                const lastMonth = subMonths(new Date(), 1);
                return {
                    from: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
                    to: format(endOfMonth(lastMonth), 'yyyy-MM-dd')
                };
            },
        },
        {
            label: 'Dieses Quartal',
            value: 'thisQuarter',
            range: () => ({
                from: format(startOfQuarter(new Date()), 'yyyy-MM-dd'),
                to: format(endOfQuarter(new Date()), 'yyyy-MM-dd')
            }),
        },
        {
            label: 'Dieses Jahr',
            value: 'thisYear',
            range: () => ({
                from: format(startOfYear(new Date()), 'yyyy-MM-dd'),
                to: format(endOfYear(new Date()), 'yyyy-MM-dd')
            }),
        },
    ];

    const handlePresetClick = (preset: typeof presets[0]) => {
        const range = preset.range();
        setFromDate(range.from);
        setToDate(range.to);
        setActivePreset(preset.value);
    };

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            {/* Preset Buttons */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg w-full sm:w-fit">
                {presets.map((preset) => (
                    <Button
                        key={preset.label}
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePresetClick(preset)}
                        className={cn(
                            "rounded-md transition-all flex-1 sm:flex-none whitespace-nowrap",
                            activePreset === preset.value
                                ? "bg-white dark:bg-slate-800 shadow-sm"
                                : "hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm"
                        )}
                    >
                        {preset.label}
                    </Button>
                ))}
            </div>

            {/* Date Inputs */}
            <div className="flex items-end gap-4">
                <div className="flex-1">
                    <Label htmlFor="from-date" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                        Von
                    </Label>
                    <Input
                        id="from-date"
                        type="date"
                        value={fromDate}
                        onChange={(e) => {
                            setFromDate(e.target.value);
                            setActivePreset('');
                        }}
                        className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div className="flex-1">
                    <Label htmlFor="to-date" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                        Bis
                    </Label>
                    <Input
                        id="to-date"
                        type="date"
                        value={toDate}
                        onChange={(e) => {
                            setToDate(e.target.value);
                            setActivePreset('');
                        }}
                        className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>
        </div>
    );
}
