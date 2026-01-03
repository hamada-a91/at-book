import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowDownLeft, ArrowUpRight, AlertCircle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface InventoryTransaction {
    id: number;
    type: 'purchase' | 'sale' | 'correction' | 'return';
    quantity: number;
    description: string;
    balance_after: number;
    created_at: string;
    reference_type: string | null;
    reference_id: number | null;
}

interface InventoryHistoryProps {
    transactions: InventoryTransaction[];
}

export function InventoryHistory({ transactions }: InventoryHistoryProps) {
    if (!transactions || transactions.length === 0) {
        return <div className="text-center py-6 text-gray-500">Keine Lagerbewegungen vorhanden.</div>;
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'purchase': return <ArrowDownLeft className="w-4 h-4 text-emerald-600" />;
            case 'sale': return <ArrowUpRight className="w-4 h-4 text-blue-600" />;
            case 'correction': return <AlertCircle className="w-4 h-4 text-orange-600" />;
            case 'return': return <RotateCcw className="w-4 h-4 text-purple-600" />;
            default: return null;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'purchase': return 'Einkauf / Zugang';
            case 'sale': return 'Verkauf / Abgang';
            case 'correction': return 'Korrektur';
            case 'return': return 'Retoure';
            default: return type;
        }
    };

    const formatReference = (type: string | null, id: number | null) => {
        if (!type || !id) return '-';
        if (type.includes('Beleg')) return `Beleg #${id}`;
        if (type.includes('Invoice')) return `Rechnung #${id}`;
        return `${type} #${id}`;
    };

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="text-right">Menge</TableHead>
                    <TableHead className="text-right">Bestand neu</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                        <TableCell className="text-sm">
                            {format(new Date(tx.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                {getTypeIcon(tx.type)}
                                <span>{getTypeLabel(tx.type)}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col">
                                <span>{tx.description}</span>
                                <span className="text-xs text-gray-500">{formatReference(tx.reference_type, tx.reference_id)}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                            <Badge variant="outline" className={tx.quantity > 0 ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-blue-600 bg-blue-50 border-blue-200"}>
                                {tx.quantity > 0 ? "+" : ""}{parseFloat(tx.quantity.toString()).toLocaleString('de-DE')}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                            {parseFloat(tx.balance_after.toString()).toLocaleString('de-DE')}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
