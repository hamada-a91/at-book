import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { Check, ChevronsUpDown, Search, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

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
    const [search, setSearch] = useState('');

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

    // Filter products based on search
    const filteredProducts = products.filter((product) => {
        const searchLower = search.toLowerCase();
        return (
            product.name.toLowerCase().includes(searchLower) ||
            (product.article_number && product.article_number.toLowerCase().includes(searchLower))
        );
    });

    const handleSelect = (product: Product) => {
        onChange(product);
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
                    {selectedProduct ? (
                        <div className="flex items-center gap-2 truncate text-slate-900 dark:text-slate-100">
                            <Package className="h-4 w-4 text-slate-500" />
                            <span className="truncate font-medium">{selectedProduct.name}</span>
                            {selectedProduct.track_stock && (
                                <Badge variant="outline" className="text-xs ml-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    {selectedProduct.stock_quantity ?? 0} Stk.
                                </Badge>
                            )}
                        </div>
                    ) : (
                        <span className="text-slate-500">
                            {isLoading ? "Laden..." : "Produkt wählen..."}
                        </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start" sideOffset={4}>
                {/* Search Input */}
                <div className="flex items-center border-b border-slate-200 px-3 dark:border-slate-700">
                    <Search className="h-4 w-4 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Produkt suchen..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                        autoFocus
                    />
                </div>

                {/* Product List */}
                <div className="max-h-[300px] overflow-y-auto p-1">
                    {filteredProducts.length === 0 ? (
                        <div className="py-6 text-center text-sm text-slate-500">
                            Kein Produkt gefunden.
                        </div>
                    ) : (
                        filteredProducts.map((product) => (
                            <div
                                key={product.id}
                                className={cn(
                                    "flex items-center justify-between rounded-md px-3 py-2 cursor-pointer transition-colors",
                                    "hover:bg-indigo-50 dark:hover:bg-indigo-900/30",
                                    value === product.id && "bg-indigo-50 dark:bg-indigo-900/30"
                                )}
                                onClick={() => handleSelect(product)}
                            >
                                <div className="flex items-center gap-2">
                                    <Check
                                        className={cn(
                                            "h-4 w-4 text-indigo-600",
                                            value === product.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-900 dark:text-slate-100">
                                            {product.name}
                                        </span>
                                        {product.article_number && (
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                Art.-Nr.: {product.article_number}
                                            </span>
                                        )}
                                    </div>
                                    {product.type === 'service' && (
                                        <Badge className="ml-2 bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 text-xs">
                                            DL
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {product.track_stock && (
                                        <Badge
                                            className={cn(
                                                "text-xs",
                                                (product.stock_quantity ?? 0) <= 0
                                                    ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400"
                                                    : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
                                            )}
                                        >
                                            {product.stock_quantity ?? 0} Stk.
                                        </Badge>
                                    )}
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        {(product.price_net / 100).toFixed(2)} €
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
