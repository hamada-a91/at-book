import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, MoreVertical, Edit, Trash, List, History as HistoryIcon, ShoppingCart } from "lucide-react";
import { CategoryManager } from "@/components/CategoryManager";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { InventoryHistory } from "@/components/InventoryHistory";

interface Product {
    id: number;
    type: string;
    name: string;
    article_number: string;
    price_net: number;
    price_gross: number;
    tax_rate: number;
    stock_quantity: number;
    track_stock: boolean;
    category?: {
        id: number;
        name: string;
        color: string | null;
    };
    inventory_transactions?: any[];
}

export default function ProductList() {
    const { tenant } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
    const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);

    const { data: productsData, isLoading } = useQuery<Product[]>({
        queryKey: ['products', search, categoryFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (categoryFilter && categoryFilter !== 'all') params.append('category_id', categoryFilter);
            const { data } = await axios.get(`/api/products?${params.toString()}`);
            // Handle both array response and object with data property
            return Array.isArray(data) ? data : (data?.data || []);
        },
    });

    // Ensure products is always an array
    const products = Array.isArray(productsData) ? productsData : [];

    // Query categories for filter
    const { data: categoriesData } = useQuery({
        queryKey: ['product-categories'],
        queryFn: async () => {
            const { data } = await axios.get('/api/product-categories');
            return Array.isArray(data) ? data : (data?.data || []);
        },
    });
    const categories = Array.isArray(categoriesData) ? categoriesData : [];

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await axios.delete(`/api/products/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });

    const handleDelete = (id: number, name: string) => {
        if (confirm(`Möchten Sie "${name}" wirklich löschen?`)) {
            deleteMutation.mutate(id);
        }
    };

    const handleShowHistory = (product: Product) => {
        setSelectedProductForHistory(product);
        setHistoryDialogOpen(true);
    };

    const handlePurchase = (productId: number) => {
        navigate(`/${tenant}/belege/create?product_id=${productId}`);
    };

    return (
        <div className="p-6 space-y-6 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 min-h-screen">
            <CategoryManager open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Package className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        Produkte & Dienstleistungen
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Verwalten Sie Ihre Artikel und Dienstleistungen
                    </p>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <Link to={`/${tenant}/products/movements`}>
                        <Button
                            variant="outline"
                            className="bg-white dark:bg-slate-800 w-full sm:w-auto"
                        >
                            <HistoryIcon className="w-4 h-4 mr-2" />
                            Lagerbewegungen
                        </Button>
                    </Link>
                    <Button
                        variant="outline"
                        onClick={() => setCategoryManagerOpen(true)}
                        className="bg-white dark:bg-slate-800 w-full sm:w-auto"
                    >
                        <List className="w-4 h-4 mr-2" />
                        Kategorien
                    </Button>
                    <Link to={`/${tenant}/products/create`}>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">
                            <Plus className="w-4 h-4 mr-2" />
                            Neuer Artikel
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-lg shadow">
                <Input
                    placeholder="Suche nach Name, Artikelnummer oder EAN..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full md:max-w-md"
                />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full md:w-64">
                        <SelectValue placeholder="Alle Kategorien" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle Kategorien</SelectItem>
                        {categories.map((cat: any) => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                                {cat.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Laden...</div>
                ) : products.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        Keine Produkte gefunden. Legen Sie Ihren ersten Artikel an!
                    </div>
                ) : (
                    <>
                        {/* Mobile List View */}
                        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                            {products.map((product) => (
                                <div key={product.id} className="p-4 active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-slate-100">{product.name}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                                {product.article_number || 'Keine Art-Nr.'}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-slate-900 dark:text-slate-100">
                                                {(product.price_net / 100).toFixed(2)} €
                                            </div>
                                            {product.track_stock && (
                                                <div className={`text-xs ${product.stock_quantity <= 0 ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                                                    {product.stock_quantity} Stk.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-3">
                                        <div className="flex gap-2">
                                            {product.category && (
                                                <Badge variant="secondary" className="font-normal text-[10px] h-5 px-1.5" style={product.category.color ? { backgroundColor: product.category.color + '20', color: product.category.color, borderColor: product.category.color + '40' } : {}}>
                                                    {product.category.name}
                                                </Badge>
                                            )}
                                            <Badge variant={product.type === 'goods' ? 'default' : 'outline'} className="text-[10px] h-5 px-1.5 font-normal">
                                                {product.type === 'goods' ? 'Ware' : 'DST'}
                                            </Badge>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-6 w-8 p-0">
                                                    <MoreVertical className="w-4 h-4 text-slate-400" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link to={`/${tenant}/products/${product.id}/edit`}>
                                                        <Edit className="w-4 h-4 mr-2" />
                                                        Bearbeiten
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleShowHistory(product)}>
                                                    <HistoryIcon className="w-4 h-4 mr-2" />
                                                    Historie
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handlePurchase(product.id)}>
                                                    <ShoppingCart className="w-4 h-4 mr-2" />
                                                    Einkaufen
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-red-600"
                                                    onClick={() => handleDelete(product.id, product.name)}
                                                >
                                                    <Trash className="w-4 h-4 mr-2" />
                                                    Löschen
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop View */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Kategorie</TableHead>
                                        <TableHead>Artikelnummer</TableHead>
                                        <TableHead>Typ</TableHead>
                                        <TableHead className="text-right">Preis (Netto)</TableHead>
                                        <TableHead className="text-right">Bestand</TableHead>
                                        <TableHead className="text-right">Aktionen</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map((product) => (
                                        <TableRow key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell>
                                                {product.category ? (
                                                    <Badge variant="secondary" className="font-normal" style={product.category.color ? { backgroundColor: product.category.color + '20', color: product.category.color, borderColor: product.category.color + '40' } : {}}>
                                                        {product.category.name}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-gray-600 dark:text-gray-400">
                                                {product.article_number || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={product.type === 'goods' ? 'default' : 'outline'}>
                                                    {product.type === 'goods' ? 'Ware' : 'Dienstleistung'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(product.price_net / 100).toFixed(2)} €
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {product.track_stock ? (
                                                    <span className={product.stock_quantity <= 0 ? "text-red-600 font-semibold" : ""}>
                                                        {product.stock_quantity}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild>
                                                            <Link to={`/${tenant}/products/${product.id}/edit`}>
                                                                <Edit className="w-4 h-4 mr-2" />
                                                                Bearbeiten
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleShowHistory(product)}>
                                                            <HistoryIcon className="w-4 h-4 mr-2" />
                                                            Historie anzeigen
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handlePurchase(product.id)}>
                                                            <ShoppingCart className="w-4 h-4 mr-2" />
                                                            Einkaufen
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-red-600"
                                                            onClick={() => handleDelete(product.id, product.name)}
                                                        >
                                                            <Trash className="w-4 h-4 mr-2" />
                                                            Löschen
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </div>

            {/* History Dialog */}
            <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>
                            Lagerbewegungen: {selectedProductForHistory?.name}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedProductForHistory?.inventory_transactions && (
                        <InventoryHistory
                            transactions={selectedProductForHistory.inventory_transactions}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
