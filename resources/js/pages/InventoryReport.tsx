import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PackageSearch, Download } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface Product {
    id: number;
    name: string;
}

interface InventoryTransaction {
    id: number;
    product_id: number;
    type: string;
    quantity: number;
    description: string;
    balance_after: number;
    created_at: string;
    product: Product;
}

export function InventoryReport() {
    const { tenant } = useParams();
    const [productId, setProductId] = useState<string>("");
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");
    const [typeFilter, setTypeFilter] = useState<string>("");

    // Fetch products for filter
    const { data: products = [] } = useQuery<Product[]>({
        queryKey: ['products'],
        queryFn: async () => {
            const { data } = await axios.get('/api/products');
            return data || [];
        },
    });

    // Fetch transactions
    const { data: transactionsData, isLoading, refetch } = useQuery({
        queryKey: ['inventory-report', productId, dateFrom, dateTo, typeFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (productId) params.append('product_id', productId);
            if (dateFrom) params.append('date_from', dateFrom);
            if (dateTo) params.append('date_to', dateTo);
            if (typeFilter) params.append('type', typeFilter);

            const { data } = await axios.get('/api/inventory-report', { params });
            return data;
        },
    });

    const transactions: InventoryTransaction[] = transactionsData?.data || [];

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'purchase': 'Einkauf',
            'sale': 'Verkauf',
            'correction': 'Korrektur',
            'return': 'Retoure',
        };
        return labels[type] || type;
    };

    const getTypeBadgeClass = (type: string) => {
        const classes: Record<string, string> = {
            'purchase': 'bg-emerald-50 text-emerald-700 border-emerald-200',
            'sale': 'bg-blue-50 text-blue-700 border-blue-200',
            'correction': 'bg-orange-50 text-orange-700 border-orange-200',
            'return': 'bg-purple-50 text-purple-700 border-purple-200',
        };
        return classes[type] || 'bg-gray-50 text-gray-700 border-gray-200';
    };

    return (
        <div className="p-6 space-y-6 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 min-h-screen">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <PackageSearch className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        Lagerbestandsbericht
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Übersicht aller Lagerbewegungen mit Filteroptionen
                    </p>
                </div>
                <Button variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    Exportieren
                </Button>
            </div>

            {/* Filters */}
            <Card className="border-none shadow-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur">
                <CardHeader>
                    <CardTitle>Filter</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <Label>Produkt</Label>
                            <Select value={productId} onValueChange={setProductId}>
                                <SelectTrigger className="bg-white dark:bg-slate-950">
                                    <SelectValue placeholder="Alle Produkte" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Alle Produkte</SelectItem>
                                    {products.map((product) => (
                                        <SelectItem key={product.id} value={product.id.toString()}>
                                            {product.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Von Datum</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="bg-white dark:bg-slate-950"
                            />
                        </div>
                        <div>
                            <Label>Bis Datum</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="bg-white dark:bg-slate-950"
                            />
                        </div>
                        <div>
                            <Label>Bewegungstyp</Label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="bg-white dark:bg-slate-950">
                                    <SelectValue placeholder="Alle Typen" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Alle Typen</SelectItem>
                                    <SelectItem value="purchase">Einkauf</SelectItem>
                                    <SelectItem value="sale">Verkauf</SelectItem>
                                    <SelectItem value="correction">Korrektur</SelectItem>
                                    <SelectItem value="return">Retoure</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button onClick={() => refetch()} variant="default" className="bg-indigo-600 hover:bg-indigo-700">
                            Filter anwenden
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Results Table */}
            <Card className="border-none shadow-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur">
                <CardHeader>
                    <CardTitle>Lagerbewegungen</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Laden...</div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            Keine Bewegungen gefunden. Passen Sie die Filter an.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Produkt</TableHead>
                                    <TableHead>Typ</TableHead>
                                    <TableHead>Beschreibung</TableHead>
                                    <TableHead className="text-right">Menge</TableHead>
                                    <TableHead className="text-right">Neuer Bestand</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map((tx) => (
                                    <TableRow key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <TableCell className="text-sm">
                                            {format(new Date(tx.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {tx.product?.name || `Produkt #${tx.product_id}`}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={getTypeBadgeClass(tx.type)}>
                                                {getTypeLabel(tx.type)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-gray-600 dark:text-gray-400">
                                            {tx.description}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={tx.quantity > 0 ? "text-emerald-600 font-semibold" : "text-blue-600 font-semibold"}>
                                                {tx.quantity > 0 ? "+" : ""}{parseFloat(tx.quantity.toString()).toLocaleString('de-DE')}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {parseFloat(tx.balance_after.toString()).toLocaleString('de-DE')}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
