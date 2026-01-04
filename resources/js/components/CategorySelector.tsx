import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

interface Category {
    id: number;
    name: string;
    description: string | null;
    color: string | null;
}

interface CategorySelectorProps {
    value?: number | null;
    onChange: (value: number | null) => void;
    onManageCategories?: () => void;
}

export function CategorySelector({ value, onChange, onManageCategories }: CategorySelectorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const { data: categoriesData, isLoading } = useQuery<Category[]>({
        queryKey: ['product-categories'],
        queryFn: async () => {
            const { data } = await axios.get('/api/product-categories');
            return Array.isArray(data) ? data : (data?.data || []);
        },
    });

    const categories = Array.isArray(categoriesData) ? categoriesData : [];
    const selectedCategory = categories.find((c) => c.id === value);

    // Filter categories based on search
    const filteredCategories = categories.filter((category) => {
        return category.name.toLowerCase().includes(search.toLowerCase());
    });

    const handleSelect = (category: Category) => {
        onChange(category.id === value ? null : category.id);
        setOpen(false);
        setSearch('');
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                >
                    {selectedCategory ? (
                        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                            {selectedCategory.color && (
                                <div
                                    className="w-3 h-3 rounded-full ring-1 ring-slate-200 dark:ring-slate-700"
                                    style={{ backgroundColor: selectedCategory.color }}
                                />
                            )}
                            <span className="font-medium">{selectedCategory.name}</span>
                        </div>
                    ) : (
                        <span className="text-slate-500">
                            {isLoading ? "Laden..." : "Kategorie wählen..."}
                        </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start" sideOffset={4}>
                {/* Search Input */}
                <div className="flex items-center border-b border-slate-200 px-3 dark:border-slate-700">
                    <Search className="h-4 w-4 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Kategorie suchen..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                        autoFocus
                    />
                </div>

                {/* Category List */}
                <div className="max-h-[250px] overflow-y-auto p-1">
                    {filteredCategories.length === 0 ? (
                        <div className="py-6 text-center text-sm text-slate-500">
                            Keine Kategorie gefunden.
                        </div>
                    ) : (
                        filteredCategories.map((category) => (
                            <div
                                key={category.id}
                                className={cn(
                                    "flex items-center rounded-md px-3 py-2 cursor-pointer transition-colors",
                                    "hover:bg-indigo-50 dark:hover:bg-indigo-900/30",
                                    value === category.id && "bg-indigo-50 dark:bg-indigo-900/30"
                                )}
                                onClick={() => handleSelect(category)}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4 text-indigo-600",
                                        value === category.id ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {category.color && (
                                    <div
                                        className="w-4 h-4 rounded-full mr-2 ring-1 ring-slate-200 dark:ring-slate-600"
                                        style={{ backgroundColor: category.color }}
                                    />
                                )}
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                    {category.name}
                                </span>
                            </div>
                        ))
                    )}
                </div>

                {/* Manage Categories Button */}
                {onManageCategories && (
                    <div className="border-t border-slate-200 dark:border-slate-700 p-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                            onClick={() => {
                                setOpen(false);
                                onManageCategories();
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Kategorien verwalten
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
