import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    ArrowDownLeft,
    ArrowUpRight,
    AlertCircle,
    RotateCcw,
    Package,
    TrendingUp,
    TrendingDown,
    Activity,
    Filter,
    RefreshCw,
    ArrowLeft,
    Calendar,
    Layers,
    FileSpreadsheet,
    PackageSearch
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface Product {
    id: number;
    name: string;
    article_number: string | null;
    stock_quantity?: number;
    category?: {
        id: number;
        name: string;
        color: string | null;
    };
}

interface Category {
    id: number;
    name: string;
    color: string | null;
}

interface InventoryTransaction {
    id: number;
    product_id: number;
    type: 'purchase' | 'sale' | 'correction' | 'return';
    quantity: number;
    description: string;
    balance_after: number;
    created_at: string;
    reference_type: string | null;
    reference_id: number | null;
    product: Product;
}

export default function InventoryMovements() {
    const { tenant } = useParams();

    // Filter states
    const [categoryId, setCategoryId] = useState<string>("all");
    const [productId, setProductId] = useState<string>("all");
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Fetch categories
    const { data: categoriesData } = useQuery<Category[]>({
        queryKey: ['product-categories'],
        queryFn: async () => {
            const { data } = await axios.get('/api/product-categories');
            return Array.isArray(data) ? data : (data?.data || []);
        },
    });
    const categories = categoriesData || [];

    // Fetch products
    const { data: productsData } = useQuery<Product[]>({
        queryKey: ['products'],
        queryFn: async () => {
            const { data } = await axios.get('/api/products');
            return Array.isArray(data) ? data : (data?.data || []);
        },
    });
    const products = productsData || [];

    // Fetch all inventory transactions
    const { data: transactionsResponse, isLoading, refetch } = useQuery({
        queryKey: ['inventory-movements', productId, dateFrom, dateTo, typeFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (productId && productId !== 'all') params.append('product_id', productId);
            if (dateFrom) params.append('date_from', dateFrom);
            if (dateTo) params.append('date_to', dateTo);
            if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter);

            const { data } = await axios.get('/api/inventory-report', { params });
            return data;
        },
    });

    const allTransactions: InventoryTransaction[] = transactionsResponse?.data || [];

    // Filter by category and search (client-side)
    const filteredTransactions = useMemo(() => {
        return allTransactions.filter((tx) => {
            // Category filter
            if (categoryId && categoryId !== 'all') {
                if (!tx.product?.category || tx.product.category.id.toString() !== categoryId) {
                    return false;
                }
            }
            // Search filter
            if (searchQuery) {
                const search = searchQuery.toLowerCase();
                const matchesProduct = tx.product?.name?.toLowerCase().includes(search);
                const matchesDescription = tx.description?.toLowerCase().includes(search);
                const matchesArticleNumber = tx.product?.article_number?.toLowerCase().includes(search);
                if (!matchesProduct && !matchesDescription && !matchesArticleNumber) {
                    return false;
                }
            }
            return true;
        });
    }, [allTransactions, categoryId, searchQuery]);

    // Calculate summary stats - with safe number handling
    const stats = useMemo(() => {
        const purchases = filteredTransactions.filter(t => t.type === 'purchase');
        const sales = filteredTransactions.filter(t => t.type === 'sale');
        const corrections = filteredTransactions.filter(t => t.type === 'correction');
        const returns = filteredTransactions.filter(t => t.type === 'return');

        // Safe number parsing
        const parseQty = (val: any) => {
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
        };

        const totalIn = purchases.reduce((sum, t) => sum + Math.abs(parseQty(t.quantity)), 0) +
            returns.reduce((sum, t) => sum + Math.abs(parseQty(t.quantity)), 0);
        const totalOut = Math.abs(sales.reduce((sum, t) => sum + parseQty(t.quantity), 0));

        // Product stats
        const productsWithStock = products.filter(p => (p.stock_quantity || 0) > 0);
        const lowStockProducts = products.filter(p => (p.stock_quantity || 0) > 0 && (p.stock_quantity || 0) <= 5);
        const totalStock = products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);

        return {
            totalMovements: filteredTransactions.length,
            totalIn: isNaN(totalIn) ? 0 : totalIn,
            totalOut: isNaN(totalOut) ? 0 : totalOut,
            netChange: (isNaN(totalIn) ? 0 : totalIn) - (isNaN(totalOut) ? 0 : totalOut),
            purchaseCount: purchases.length,
            saleCount: sales.length,
            correctionCount: corrections.length,
            returnCount: returns.length,
            productsWithStock: productsWithStock.length,
            lowStockWarnings: lowStockProducts.length,
            totalStock: isNaN(totalStock) ? 0 : totalStock,
        };
    }, [filteredTransactions, products]);

    // Filter products by category
    const filteredProducts = useMemo(() => {
        if (categoryId === 'all') return products;
        return products.filter(p => p.category?.id.toString() === categoryId);
    }, [products, categoryId]);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'purchase': return <ArrowDownLeft className="w-4 h-4" />;
            case 'sale': return <ArrowUpRight className="w-4 h-4" />;
            case 'correction': return <AlertCircle className="w-4 h-4" />;
            case 'return': return <RotateCcw className="w-4 h-4" />;
            default: return null;
        }
    };

    const getTypeStyles = (type: string) => {
        switch (type) {
            case 'purchase': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
            case 'sale': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
            case 'correction': return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
            case 'return': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
            default: return 'bg-gray-50 text-gray-700 border-gray-200';
        }
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'purchase': 'Einkauf',
            'sale': 'Verkauf',
            'correction': 'Korrektur',
            'return': 'Retoure',
        };
        return labels[type] || type;
    };

    const resetFilters = () => {
        setCategoryId('all');
        setProductId('all');
        setDateFrom('');
        setDateTo('');
        setTypeFilter('all');
        setSearchQuery('');
    };

    // Export to CSV
    const handleExport = () => {
        if (filteredTransactions.length === 0) return;

        const headers = ['Datum', 'Zeit', 'Produkt', 'Artikelnummer', 'Kategorie', 'Typ', 'Beschreibung', 'Menge', 'Bestand danach'];
        const rows = filteredTransactions.map(tx => [
            format(new Date(tx.created_at), "dd.MM.yyyy", { locale: de }),
            format(new Date(tx.created_at), "HH:mm", { locale: de }),
            tx.product?.name || `Produkt #${tx.product_id}`,
            tx.product?.article_number || '',
            tx.product?.category?.name || '',
            getTypeLabel(tx.type),
            tx.description,
            parseFloat(tx.quantity.toString()).toLocaleString('de-DE'),
            parseFloat(tx.balance_after.toString()).toLocaleString('de-DE'),
        ]);

        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `lagerbewegungen_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4 md:p-6 pb-20 md:pb-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <Link to={`/${tenant}/products`}>
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white shrink-0">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div className="min-w-0">
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 md:gap-3 truncate">
                                <Activity className="w-6 h-6 md:w-8 md:h-8 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span className="truncate">Lagerbewegungen</span>
                            </h1>
                            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                                Ein- und Ausgänge Ihrer Produkte
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button variant="outline" onClick={() => refetch()} className="flex-1 md:flex-none gap-2">
                            <RefreshCw className="w-4 h-4" />
                            Aktualisieren
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleExport}
                            disabled={filteredTransactions.length === 0}
                            className="flex-1 md:flex-none gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            CSV Export
                        </Button>
                    </div>
                </div>

                {/* Stats Cards - Optimized for mobile (2 columns) */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
                    <Card className="border-none shadow-lg bg-white dark:bg-slate-900">
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide truncate">Gesamtbestand</p>
                                    <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                        {stats.totalStock.toLocaleString('de-DE')}
                                    </p>
                                </div>
                                <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center shrink-0">
                                    <Package className="w-4 h-4 md:w-5 md:h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-lg bg-white dark:bg-slate-900">
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide truncate">Mit Bestand</p>
                                    <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                        {stats.productsWithStock}
                                    </p>
                                </div>
                                <div className="w-8 h-8 md:w-10 md:h-10 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center shrink-0">
                                    <PackageSearch className="w-4 h-4 md:w-5 md:h-5 text-cyan-600 dark:text-cyan-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-lg bg-white dark:bg-slate-900">
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide truncate">Niedrig</p>
                                    <p className="text-lg md:text-2xl font-bold text-orange-600 mt-1">
                                        {stats.lowStockWarnings}
                                    </p>
                                </div>
                                <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center shrink-0">
                                    <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-orange-600 dark:text-orange-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-lg bg-white dark:bg-slate-900">
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] md:text-xs text-emerald-600 uppercase tracking-wide font-medium truncate">Eingänge</p>
                                    <p className="text-lg md:text-2xl font-bold text-emerald-600 mt-1">
                                        +{stats.totalIn.toLocaleString('de-DE')}
                                    </p>
                                </div>
                                <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center shrink-0">
                                    <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-lg bg-white dark:bg-slate-900">
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] md:text-xs text-blue-600 uppercase tracking-wide font-medium truncate">Ausgänge</p>
                                    <p className="text-lg md:text-2xl font-bold text-blue-600 mt-1">
                                        -{stats.totalOut.toLocaleString('de-DE')}
                                    </p>
                                </div>
                                <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                                    <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-lg bg-white dark:bg-slate-900">
                        <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide truncate">Bewegungen</p>
                                    <p className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                        {stats.totalMovements.toLocaleString('de-DE')}
                                    </p>
                                </div>
                                <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center shrink-0">
                                    <Activity className="w-4 h-4 md:w-5 md:h-5 text-gray-600 dark:text-gray-400" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card className="border-none shadow-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur">
                    <CardHeader className="pb-4 p-4 md:p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Filter className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                <CardTitle className="text-lg md:text-xl">Filter</CardTitle>
                            </div>
                            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-gray-500 hover:text-gray-700 h-8 px-2">
                                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                Zurücksetzen
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6 pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                            {/* Search */}
                            <div className="lg:col-span-2">
                                <Label className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">Suche</Label>
                                <Input
                                    placeholder="Produkt, Beschreibung..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="mt-1 bg-white dark:bg-slate-950 h-9 md:h-10"
                                />
                            </div>

                            {/* Category */}
                            <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:col-span-1">
                                <div>
                                    <Label className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                        <Layers className="w-3 h-3" />
                                        Kategorie
                                    </Label>
                                    <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setProductId('all'); }}>
                                        <SelectTrigger className="mt-1 bg-white dark:bg-slate-950 h-9 md:h-10">
                                            <SelectValue placeholder="Alle" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Alle Kategorien</SelectItem>
                                            {categories.map((cat) => (
                                                <SelectItem key={cat.id} value={cat.id.toString()}>
                                                    <div className="flex items-center gap-2">
                                                        {cat.color && (
                                                            <div
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: cat.color }}
                                                            />
                                                        )}
                                                        {cat.name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="lg:hidden">
                                    <Label className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                        <Package className="w-3 h-3" />
                                        Produkt
                                    </Label>
                                    <Select value={productId} onValueChange={setProductId}>
                                        <SelectTrigger className="mt-1 bg-white dark:bg-slate-950 h-9 md:h-10">
                                            <SelectValue placeholder="Alle" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Alle Produkte</SelectItem>
                                            {filteredProducts.map((product) => (
                                                <SelectItem key={product.id} value={product.id.toString()}>
                                                    {product.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Product - Desktop and Large view */}
                            <div className="hidden lg:block lg:col-span-1">
                                <Label className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                    <Package className="w-3 h-3" />
                                    Produkt
                                </Label>
                                <Select value={productId} onValueChange={setProductId}>
                                    <SelectTrigger className="mt-1 bg-white dark:bg-slate-950 h-9 md:h-10">
                                        <SelectValue placeholder="Alle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Alle Produkte</SelectItem>
                                        {filteredProducts.map((product) => (
                                            <SelectItem key={product.id} value={product.id.toString()}>
                                                {product.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Type */}
                            <div>
                                <Label className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide">Typ</Label>
                                <Select value={typeFilter} onValueChange={setTypeFilter}>
                                    <SelectTrigger className="mt-1 bg-white dark:bg-slate-950 h-9 md:h-10">
                                        <SelectValue placeholder="Alle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Alle Typen</SelectItem>
                                        <SelectItem value="purchase">
                                            <div className="flex items-center gap-2">
                                                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                                                Einkauf
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="sale">
                                            <div className="flex items-center gap-2">
                                                <ArrowUpRight className="w-4 h-4 text-blue-600" />
                                                Verkauf
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="correction">
                                            <div className="flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4 text-orange-600" />
                                                Korrektur
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="return">
                                            <div className="flex items-center gap-2">
                                                <RotateCcw className="w-4 h-4 text-purple-600" />
                                                Retoure
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Date Range - Responsive */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <div className="col-span-1">
                                <Label className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Von
                                </Label>
                                <Input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="mt-1 bg-white dark:bg-slate-950 h-9 md:h-10 text-xs md:text-sm"
                                />
                            </div>
                            <div className="col-span-1">
                                <Label className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Bis
                                </Label>
                                <Input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="mt-1 bg-white dark:bg-slate-950 h-9 md:h-10 text-xs md:text-sm"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Results Table & Mobile View */}
                <Card className="border-none shadow-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur overflow-hidden">
                    <CardHeader className="border-b border-gray-100 dark:border-gray-800 p-4 md:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg md:text-xl">Bewegungen</CardTitle>
                                <CardDescription>
                                    {filteredTransactions.length} Einträge gefunden
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : filteredTransactions.length === 0 ? (
                            <div className="text-center py-16">
                                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-gray-400">
                                    Keine Bewegungen gefunden.
                                </p>
                                <p className="text-xs md:text-sm text-gray-400 dark:text-gray-500 mt-1">
                                    Passen Sie die Filter an oder erstellen Sie Belege.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                                                <TableHead className="font-semibold">Datum</TableHead>
                                                <TableHead className="font-semibold">Produkt</TableHead>
                                                <TableHead className="font-semibold">Kategorie</TableHead>
                                                <TableHead className="font-semibold">Typ</TableHead>
                                                <TableHead className="font-semibold">Beschreibung</TableHead>
                                                <TableHead className="text-right font-semibold">Menge</TableHead>
                                                <TableHead className="text-right font-semibold">Bestand</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredTransactions.map((tx) => (
                                                <TableRow
                                                    key={tx.id}
                                                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                                >
                                                    <TableCell className="font-medium text-sm">
                                                        <div className="flex flex-col">
                                                            <span>{format(new Date(tx.created_at), "dd.MM.yyyy", { locale: de })}</span>
                                                            <span className="text-xs text-gray-400">
                                                                {format(new Date(tx.created_at), "HH:mm", { locale: de })}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-gray-900 dark:text-gray-100">
                                                                {tx.product?.name || `Produkt #${tx.product_id}`}
                                                            </span>
                                                            {tx.product?.article_number && (
                                                                <span className="text-xs text-gray-400">
                                                                    {tx.product.article_number}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {tx.product?.category ? (
                                                            <Badge
                                                                variant="secondary"
                                                                className="font-normal"
                                                                style={tx.product.category.color ? {
                                                                    backgroundColor: tx.product.category.color + '20',
                                                                    color: tx.product.category.color,
                                                                    borderColor: tx.product.category.color + '40'
                                                                } : {}}
                                                            >
                                                                {tx.product.category.name}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={`gap-1 ${getTypeStyles(tx.type)}`}
                                                        >
                                                            {getTypeIcon(tx.type)}
                                                            {getTypeLabel(tx.type)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px] truncate text-gray-600 dark:text-gray-400">
                                                        {tx.description}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className={`font-bold text-lg ${parseFloat(tx.quantity?.toString() || '0') > 0
                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                            : 'text-blue-600 dark:text-blue-400'
                                                            }`}>
                                                            {parseFloat(tx.quantity?.toString() || '0') > 0 ? '+' : ''}
                                                            {parseFloat(tx.quantity?.toString() || '0').toLocaleString('de-DE')}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="font-medium text-gray-900 dark:text-gray-100">
                                                            {parseFloat(tx.balance_after?.toString() || '0').toLocaleString('de-DE')}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Mobile List View */}
                                <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
                                    {filteredTransactions.map((tx) => (
                                        <div key={tx.id} className="p-4 active:bg-gray-50 dark:active:bg-gray-800/50 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-500 mb-1">
                                                        {format(new Date(tx.created_at), "dd.MM.yyyy, HH:mm", { locale: de })}
                                                    </span>
                                                    <span className="font-bold text-gray-900 dark:text-white line-clamp-1">
                                                        {tx.product?.name || `Produkt #${tx.product_id}`}
                                                    </span>
                                                    {tx.product?.article_number && (
                                                        <span className="text-[10px] text-gray-400">
                                                            Art.Nr: {tx.product.article_number}
                                                        </span>
                                                    )}
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={`gap-1 scale-90 origin-right ${getTypeStyles(tx.type)}`}
                                                >
                                                    {getTypeIcon(tx.type)}
                                                    {getTypeLabel(tx.type)}
                                                </Badge>
                                            </div>

                                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                                                {tx.description}
                                            </p>

                                            <div className="flex justify-between items-center pt-2 border-t border-gray-50 dark:border-gray-800/50">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-500 uppercase">Danach:</span>
                                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        {parseFloat(tx.balance_after?.toString() || '0').toLocaleString('de-DE')}
                                                    </span>
                                                </div>
                                                <div className={`text-lg font-bold ${parseFloat(tx.quantity?.toString() || '0') > 0
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : 'text-blue-600 dark:text-blue-400'
                                                    }`}>
                                                    {parseFloat(tx.quantity?.toString() || '0') > 0 ? '+' : ''}
                                                    {parseFloat(tx.quantity?.toString() || '0').toLocaleString('de-DE')}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
