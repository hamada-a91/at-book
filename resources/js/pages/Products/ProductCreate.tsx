import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Info } from "lucide-react";
import { CategorySelector } from "@/components/CategorySelector";
import { CategoryManager } from "@/components/CategoryManager";
import { InventoryHistory } from "@/components/InventoryHistory";

export default function ProductCreate() {
    const { tenant, id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;
    const queryClient = useQueryClient();

    // Form State
    const [type, setType] = useState<'goods' | 'service'>('goods');
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
    const [description, setDescription] = useState('');
    const [articleNumber, setArticleNumber] = useState('');
    const [gtinEan, setGtinEan] = useState('');

    // Price State
    const [priceNet, setPriceNet] = useState<string>('0,00');
    const [priceGross, setPriceGross] = useState<string>('0,00');
    const [taxRate, setTaxRate] = useState<string>('19');
    const [unit, setUnit] = useState('Stück');

    // Inventory State
    const [trackStock, setTrackStock] = useState(false);
    const [stockQuantity, setStockQuantity] = useState<string>('0');
    const [reorderLevel, setReorderLevel] = useState<string>('');

    // Notes
    const [notes, setNotes] = useState('');

    // Loading Data
    const { data: product, isLoading } = useQuery({
        queryKey: ['product', id],
        queryFn: async () => {
            if (!id) return null;
            const { data } = await axios.get(`/api/products/${id}`);
            return data;
        },
        enabled: isEditMode,
    });

    // Populate Form
    useEffect(() => {
        if (product) {
            setType(product.type);
            setName(product.name);
            setCategoryId(product.category_id || null);
            setDescription(product.description || '');
            setArticleNumber(product.article_number || '');
            setGtinEan(product.gtin_ean || '');

            setPriceNet((product.price_net / 100).toFixed(2).replace('.', ','));
            setPriceGross((product.price_gross / 100).toFixed(2).replace('.', ','));
            setTaxRate(Math.round(product.tax_rate).toString());
            setUnit(product.unit || 'Stück');

            setTrackStock(product.track_stock);
            setStockQuantity(product.stock_quantity?.toString() || '0');
            setReorderLevel(product.reorder_level?.toString() || '');
            setNotes(product.notes || '');
        }
    }, [product]);

    // Price Calculation Logic
    const parseCurrency = (val: string) => parseFloat(val.replace(',', '.') || '0');
    const formatCurrencyInput = (val: number) => val.toFixed(2).replace('.', ',');

    const handleNetChange = (val: string) => {
        setPriceNet(val);
        const net = parseCurrency(val);
        const tax = parseFloat(taxRate);
        const gross = net * (1 + tax / 100);
        setPriceGross(formatCurrencyInput(gross));
    };

    const handleGrossChange = (val: string) => {
        setPriceGross(val);
        const gross = parseCurrency(val);
        const tax = parseFloat(taxRate);
        const net = gross / (1 + tax / 100);
        setPriceNet(formatCurrencyInput(net));
    };

    const handleTaxChange = (val: string) => {
        setTaxRate(val);
        const net = parseCurrency(priceNet);
        const tax = parseFloat(val);
        const gross = net * (1 + tax / 100);
        setPriceGross(formatCurrencyInput(gross));
    };

    // Mutation
    const mutation = useMutation({
        mutationFn: async (data: any) => {
            if (isEditMode) {
                const { data: res } = await axios.put(`/api/products/${id}`, data);
                return res;
            } else {
                const { data: res } = await axios.post('/api/products', data);
                return res;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            navigate(`/${tenant}/products`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            type,
            name,
            category_id: categoryId,
            description,
            article_number: articleNumber,
            gtin_ean: gtinEan,
            unit,
            price_net: Math.round(parseCurrency(priceNet) * 100), // cents
            price_gross: Math.round(parseCurrency(priceGross) * 100), // cents
            tax_rate: parseFloat(taxRate),
            track_stock: type === 'goods' ? trackStock : false,
            stock_quantity: parseCurrency(stockQuantity),
            reorder_level: reorderLevel ? parseCurrency(reorderLevel) : null,
            notes,
        };

        mutation.mutate(payload);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <CategoryManager open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} />
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link to={`/${tenant}/products`}>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-700 dark:text-gray-300">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {isEditMode ? 'Artikel bearbeiten' : 'Neuen Artikel anlegen'}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Erfassen Sie hier die Stammdaten für Ihre Produkte oder Dienstleistungen.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Stammdaten */}
                    <Card className="border-none shadow-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur">
                        <CardHeader>
                            <CardTitle>Stammdaten</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center space-x-2 pb-4 border-b border-gray-100 dark:border-gray-800">
                                <span className="font-semibold text-sm">Typ:</span>
                                <RadioGroup value={type} onValueChange={(val: any) => setType(val)} className="flex gap-4">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="goods" id="r-goods" />
                                        <Label htmlFor="r-goods">Produkt (Ware)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="service" id="r-service" />
                                        <Label htmlFor="r-service">Dienstleistung</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="grid gap-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="name">Bezeichnung *</Label>
                                        <Input
                                            id="name"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            required
                                            className="bg-white dark:bg-slate-950"
                                            placeholder="z.B. Premium Widget"
                                        />
                                    </div>
                                    <div>
                                        <Label className="mb-2 block">Kategorie</Label>
                                        <CategorySelector
                                            value={categoryId}
                                            onChange={setCategoryId}
                                            onManageCategories={() => setCategoryManagerOpen(true)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="description">Beschreibung</Label>
                                    <Textarea
                                        id="description"
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        className="bg-white dark:bg-slate-950"
                                        placeholder="Detaillierte Beschreibung für Angebote/Rechnungen"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="article_number">Artikelnummer</Label>
                                        <Input
                                            id="article_number"
                                            value={articleNumber}
                                            onChange={e => setArticleNumber(e.target.value)}
                                            className="bg-white dark:bg-slate-950"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="gtin">GTIN / EAN</Label>
                                        <Input
                                            id="gtin"
                                            value={gtinEan}
                                            onChange={e => setGtinEan(e.target.value)}
                                            className="bg-white dark:bg-slate-950"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Preise */}
                    <Card className="border-none shadow-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur">
                        <CardHeader>
                            <CardTitle>Preise</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <div>
                                    <Label className="mb-2 block">Steuer</Label>
                                    <Select value={taxRate} onValueChange={handleTaxChange}>
                                        <SelectTrigger className="bg-white dark:bg-slate-950">
                                            <SelectValue placeholder="Wählen" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="19">USt 19%</SelectItem>
                                            <SelectItem value="7">USt 7%</SelectItem>
                                            <SelectItem value="0">Steuerfrei (0%)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="price_net" className="mb-2 block">VK (Netto)</Label>
                                    <div className="relative">
                                        <Input
                                            id="price_net"
                                            value={priceNet}
                                            onChange={e => handleNetChange(e.target.value)}
                                            className="bg-white dark:bg-slate-950 pr-8"
                                        />
                                        <span className="absolute right-3 top-2.5 text-gray-400 text-sm">€</span>
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="price_gross" className="mb-2 block">VK (Brutto)</Label>
                                    <div className="relative">
                                        <Input
                                            id="price_gross"
                                            value={priceGross}
                                            onChange={e => handleGrossChange(e.target.value)}
                                            className="bg-white dark:bg-slate-950 pr-8"
                                        />
                                        <span className="absolute right-3 top-2.5 text-gray-400 text-sm">€</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 w-full md:w-1/3">
                                <Label htmlFor="unit" className="mb-2 block">Einheit</Label>
                                <Select value={unit} onValueChange={setUnit}>
                                    <SelectTrigger className="bg-white dark:bg-slate-950">
                                        <SelectValue placeholder="Einheit wählen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Stück">Stück</SelectItem>
                                        <SelectItem value="Stunde">Stunde</SelectItem>
                                        <SelectItem value="Stunden">Stunden</SelectItem>
                                        <SelectItem value="Tag">Tag</SelectItem>
                                        <SelectItem value="Tage">Tage</SelectItem>
                                        <SelectItem value="Woche">Woche</SelectItem>
                                        <SelectItem value="Monat">Monat</SelectItem>
                                        <SelectItem value="Jahr">Jahr</SelectItem>
                                        <SelectItem value="Meter">Meter</SelectItem>
                                        <SelectItem value="m²">m² (Quadratmeter)</SelectItem>
                                        <SelectItem value="m³">m³ (Kubikmeter)</SelectItem>
                                        <SelectItem value="km">km (Kilometer)</SelectItem>
                                        <SelectItem value="kg">kg (Kilogramm)</SelectItem>
                                        <SelectItem value="g">g (Gramm)</SelectItem>
                                        <SelectItem value="Liter">Liter</SelectItem>
                                        <SelectItem value="ml">ml (Milliliter)</SelectItem>
                                        <SelectItem value="Pauschale">Pauschale</SelectItem>
                                        <SelectItem value="Paket">Paket</SelectItem>
                                        <SelectItem value="Karton">Karton</SelectItem>
                                        <SelectItem value="Set">Set</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Inventory (conditional) */}
                    {type === 'goods' && (
                        <Card className="border-none shadow-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur">
                            <CardHeader className="flex flex-row justify-between items-center">
                                <CardTitle>Lager & Inventar</CardTitle>
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="track_stock"
                                        checked={trackStock}
                                        onCheckedChange={setTrackStock}
                                    />
                                    <Label htmlFor="track_stock">Bestand führen</Label>
                                </div>
                            </CardHeader>
                            {trackStock && (
                                <CardContent className="space-y-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex gap-3 text-sm text-blue-700 dark:text-blue-300">
                                        <Info className="w-5 h-5 flex-shrink-0" />
                                        <p>
                                            Wenn Sie "Bestand führen" aktivieren, wird der Lagerbestand bei Rechnungsstellung automatisch reduziert.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="stock_quantity">Aktueller Bestand</Label>
                                            {!isEditMode ? (
                                                <Input
                                                    id="stock_quantity"
                                                    type="number"
                                                    value={stockQuantity}
                                                    onChange={e => setStockQuantity(e.target.value)}
                                                    className="bg-white dark:bg-slate-950"
                                                />
                                            ) : (
                                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                                    {stockQuantity} {unit}
                                                </div>
                                            )}
                                            {isEditMode && <p className="text-xs text-gray-500 mt-1">Bestandskorrekturen bitte über "Inventur" oder Belege vornehmen.</p>}
                                        </div>
                                        <div>
                                            <Label htmlFor="reorder_level">Meldebestand</Label>
                                            <Input
                                                id="reorder_level"
                                                type="number"
                                                value={reorderLevel}
                                                onChange={e => setReorderLevel(e.target.value)}
                                                placeholder="z.B. 10"
                                                className="bg-white dark:bg-slate-950"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Sie werden benachrichtigt, wenn der Bestand diesen Wert unterschreitet.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* Notiz */}
                    <Card className="border-none shadow-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur">
                        <CardHeader>
                            <CardTitle>Notiz (intern)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="bg-white dark:bg-slate-950"
                                placeholder="Interne Anmerkungen..."
                            />
                        </CardContent>
                    </Card>

                    {/* Inventory History (Edit Mode Only) */}
                    {isEditMode && product?.inventory_transactions && (
                        <Card className="border-none shadow-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur">
                            <CardHeader>
                                <CardTitle>Lagerhistorie</CardTitle>
                                <CardDescription>Die letzten 50 Lagerbewegungen dieses Artikels.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <InventoryHistory transactions={product.inventory_transactions} />
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex justify-end gap-3 pb-8">
                        <Link to={`/${tenant}/products`}>
                            <Button variant="outline">Abbrechen</Button>
                        </Link>
                        <Button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[150px]"
                            disabled={mutation.isPending}
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {mutation.isPending ? 'Speichere...' : 'Speichern'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
