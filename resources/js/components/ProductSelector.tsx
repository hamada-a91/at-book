import { useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
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

    const { data: productsData } = useQuery<Product[]>({
        queryKey: ['products', typeFilter],
        queryFn: async () => {
            const params = typeFilter ? `?type=${typeFilter}` : '';
            const { data } = await axios.get(`/api/products${params}`);
            return Array.isArray(data) ? data : (data?.data || []);
        },
    });

    const products = Array.isArray(productsData) ? productsData : [];
    const selectedProduct = products.find((p) => p.id === value);

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
                        <div className="flex items-center gap-2 overflow-hidden">
                            <span className="truncate">{selectedProduct.name}</span>
                            {selectedProduct.article_number && (
                                <span className="text-xs text-gray-500">({selectedProduct.article_number})</span>
                            )}
                        </div>
                    ) : (
                        "Produkt wählen..."
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
                                    value={product.id.toString()}
                                    keywords={[product.name, product.article_number || '']}
                                    onSelect={(selectedValue) => {
                                        const productId = parseInt(selectedValue);
                                        const selected = products.find(p => p.id === productId);
                                        onChange(selected || null);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === product.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col flex-1 gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{product.name}</span>
                                            {product.type === 'service' && (
                                                <Badge variant="outline" className="text-xs">DL</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            {product.article_number && (
                                                <span>Art.Nr: {product.article_number}</span>
                                            )}
                                            <span>•</span>
                                            <span>{(product.price_net / 100).toFixed(2)} € (netto)</span>
                                            {product.category && (
                                                <>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        {product.category.color && (
                                                            <div
                                                                className="w-2 h-2 rounded-full"
                                                                style={{ backgroundColor: product.category.color }}
                                                            />
                                                        )}
                                                        {product.category.name}
                                                    </span>
                                                </>
                                            )}
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
