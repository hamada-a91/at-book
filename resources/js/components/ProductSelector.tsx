import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Check, ChevronsUpDown } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

interface Product {
    id: number;
    name: string;
    type: string;
    article_number: string | null;
    price_net: number;
    price_gross: number;
    tax_rate: number;
    unit: string;
    stock_quantity?: number;
    track_stock?: boolean;
    category?: {
        id: number;
        name: string;
        color: string | null;
    };
}

interface ProductSelectorProps {
    value?: number | null;
    onChange: (product: Product | null) => void;
    typeFilter?: 'goods' | 'service' | null;
}

export function ProductSelector({ value, onChange, typeFilter = null }: ProductSelectorProps) {
    const [open, setOpen] = useState(false);

    const { data: productsData, isLoading } = useQuery<Product[]>({
        queryKey: ['products', typeFilter],
        queryFn: async () => {
            const params = typeFilter ? `?type=${typeFilter}` : '';
            const { data } = await axios.get(`/api/products${params}`);
            if (Array.isArray(data)) {
                return data;
            }
            if (data?.data && Array.isArray(data.data)) {
                return data.data;
            }
            return [];
        },
    });

    const products: Product[] = Array.isArray(productsData) ? productsData : [];
    const selectedProduct = products.find((p) => p.id === value);

    const handleSelect = (product: Product) => {
        console.log('ProductSelector: Selected product:', product);
        onChange(product);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-white dark:bg-slate-950"
                >
                    {selectedProduct ? (
                        <div className="flex items-center gap-2 truncate">
                            <span className="truncate">{selectedProduct.name}</span>
                            {selectedProduct.track_stock && (
                                <Badge variant="outline" className="text-xs ml-1">
                                    {selectedProduct.stock_quantity ?? 0} Stk.
                                </Badge>
                            )}
                        </div>
                    ) : (
                        <span className="text-muted-foreground">
                            {isLoading ? "Laden..." : "Produkt wählen..."}
                        </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput placeholder="Produkt suchen..." />
                    <CommandList>
                        <CommandEmpty>Kein Produkt gefunden.</CommandEmpty>
                        <CommandGroup>
                            {products.map((product) => (
                                <CommandItem
                                    key={product.id}
                                    value={`${product.name} ${product.article_number || ''}`}
                                    onSelect={() => handleSelect(product)}
                                    onClick={() => handleSelect(product)}
                                    className="cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === product.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{product.name}</span>
                                            {product.article_number && (
                                                <span className="text-xs text-gray-500">
                                                    ({product.article_number})
                                                </span>
                                            )}
                                            {product.type === 'service' && (
                                                <Badge variant="outline" className="text-xs">DL</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            {product.track_stock && (
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-xs",
                                                        (product.stock_quantity ?? 0) <= 0
                                                            ? "text-red-600 border-red-200"
                                                            : "text-emerald-600 border-emerald-200"
                                                    )}
                                                >
                                                    {product.stock_quantity ?? 0} Stk.
                                                </Badge>
                                            )}
                                            <span className="text-gray-400">
                                                {(product.price_net / 100).toFixed(2)} €
                                            </span>
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

