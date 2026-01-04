import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';

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

    const { data: categoriesData, isLoading } = useQuery<Category[]>({
        queryKey: ['product-categories'],
        queryFn: async () => {
            const { data } = await axios.get('/api/product-categories');
            return Array.isArray(data) ? data : (data?.data || []);
        },
    });

    const categories = Array.isArray(categoriesData) ? categoriesData : [];
    const selectedCategory = categories.find((c) => c.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-white dark:bg-slate-950"
                >
                    {selectedCategory ? (
                        <div className="flex items-center gap-2">
                            {selectedCategory.color && (
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedCategory.color }} />
                            )}
                            {selectedCategory.name}
                        </div>
                    ) : (
                        "Kategorie wählen..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput placeholder="Kategorie suchen..." />
                    <CommandList>
                        <CommandEmpty>Keine Kategorie gefunden.</CommandEmpty>
                        <CommandGroup>
                            {categories.map((category) => (
                                <CommandItem
                                    key={category.id}
                                    value={category.name.toLowerCase()}
                                    keywords={[category.id.toString()]}
                                    onSelect={() => {
                                        onChange(category.id === value ? null : category.id);
                                        setOpen(false);
                                    }}
                                    onClick={() => {
                                        onChange(category.id === value ? null : category.id);
                                        setOpen(false);
                                    }}
                                    className="cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === category.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {category.color && (
                                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: category.color }} />
                                    )}
                                    {category.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {onManageCategories && (
                            <div className="p-2 border-t mt-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
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
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
