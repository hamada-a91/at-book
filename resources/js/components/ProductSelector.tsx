import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
    const { data: productsData, isLoading } = useQuery<Product[]>({
        queryKey: ['products', typeFilter],
        queryFn: async () => {
            const params = typeFilter ? `?type=${typeFilter}` : '';
            const { data } = await axios.get(`/api/products${params}`);
            // Handle both array and paginated response
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

    // Handle selection change
    const handleValueChange = (selectedValue: string) => {
        console.log('ProductSelector: Value changed to:', selectedValue);

        if (!selectedValue || selectedValue === 'none') {
            onChange(null);
            return;
        }

        const productId = parseInt(selectedValue, 10);
        const selectedProduct = products.find((p) => p.id === productId);

        if (selectedProduct) {
            console.log('ProductSelector: Selected product:', selectedProduct);
            console.log('ProductSelector: Product ID:', selectedProduct.id);
            onChange(selectedProduct);
        } else {
            console.error('ProductSelector: Could not find product with ID:', productId);
            onChange(null);
        }
    };

    // Debug: Log products when loaded
    useEffect(() => {
        if (products.length > 0) {
            console.log('ProductSelector: Products loaded:', products.length);
            console.log('ProductSelector: First product:', products[0]);
        }
    }, [products]);

    return (
        <Select
            value={value ? value.toString() : undefined}
            onValueChange={handleValueChange}
        >
            <SelectTrigger className="w-full bg-white dark:bg-slate-950">
                <SelectValue placeholder={isLoading ? "Laden..." : "Produkt wählen..."} />
            </SelectTrigger>
            <SelectContent>
                {products.map((product) => (
                    <SelectItem
                        key={product.id}
                        value={product.id.toString()}
                        className="cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{product.name}</span>
                            {product.article_number && (
                                <span className="text-xs text-gray-500">
                                    ({product.article_number})
                                </span>
                            )}
                            {product.type === 'service' && (
                                <Badge variant="outline" className="text-xs ml-1">DL</Badge>
                            )}
                            <span className="text-xs text-gray-400 ml-auto">
                                {(product.price_net / 100).toFixed(2)} €
                            </span>
                        </div>
                    </SelectItem>
                ))}
                {products.length === 0 && !isLoading && (
                    <div className="p-2 text-sm text-gray-500 text-center">
                        Keine Produkte gefunden
                    </div>
                )}
            </SelectContent>
        </Select>
    );
}
