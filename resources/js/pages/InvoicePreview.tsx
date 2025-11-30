import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Printer, Download, Send, Save } from 'lucide-react';

interface Invoice {
    id: number;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    status: string;
    subtotal: number;
    tax_total: number;
    total: number;
    intro_text: string;
    payment_terms: string;
    footer_note: string;
    contact: {
        id: number;
        name: string;
        address: string;
    };
    lines: Array<{
        description: string;
        quantity: number;
        unit: string;
        unit_price: number;
        tax_rate: number;
        line_total: number;
    }>;
}

interface CompanySetting {
    company_name: string;
    address: string;
    email: string;
    phone: string;
    tax_number: string;
    logo_url?: string;
}

export function InvoicePreview() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: invoice, isLoading } = useQuery<Invoice>({
        queryKey: ['invoice', id],
        queryFn: async () => {
            const res = await fetch(`/api/invoices/${id}`);
            return res.json();
        },
    });

    const { data: settings } = useQuery<CompanySetting>({
        queryKey: ['settings'],
        queryFn: async () => {
            const res = await fetch('/api/settings');
            return res.json();
        },
    });

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
        }).format(cents / 100);
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('de-DE');
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = () => {
        window.open(`/api/invoices/${id}/pdf`, '_blank');
    };

    const handleSend = async () => {
        // TODO: Implement send functionality
        alert('Rechnung senden - Feature kommt noch!');
    };

    if (isLoading || !invoice) {
        return (
            <div className="flex items-center justify-center h-64">
                <p>Laden...</p>
            </div>
        );
    }

    return (
        <>
            {/* Action Buttons - Hidden on print */}
            <div className="print:hidden bg-slate-100 p-4 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Rechnungsvorschau</h2>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>
                            <Save className="w-4 h-4 mr-1" />
                            Zurück
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="w-4 h-4 mr-1" />
                            Drucken
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                            <Download className="w-4 h-4 mr-1" />
                            PDF
                        </Button>
                        {invoice.status === 'draft' && (
                            <Button size="sm" onClick={handleSend}>
                                <Send className="w-4 h-4 mr-1" />
                                Senden
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Invoice Document - Optimized for printing */}
            <div className="bg-white min-h-screen print:min-h-0">
                <div className="max-w-4xl mx-auto p-8 print:p-12">
                    {/* Header with Logo */}
                    <div className="flex justify-between items-start mb-12">
                        <div>
                            {settings?.logo_url && (
                                <img src={settings.logo_url} alt="Logo" className="h-16 mb-4" />
                            )}
                            <h1 className="text-3xl font-bold text-slate-900">
                                {settings?.company_name || 'Vorpoint'}
                            </h1>
                        </div>
                        <div className="text-right">
                            <h2 className="text-2xl font-bold mb-4">Rechnung</h2>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between gap-4">
                                    <span className="font-medium">Rechnungsnr.:</span>
                                    <span>{invoice.invoice_number}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="font-medium">Kundennr.:</span>
                                    <span>{invoice.contact.id}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="font-medium">Datum:</span>
                                    <span>{formatDate(invoice.invoice_date)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="font-medium">Lieferdatum:</span>
                                    <span>{formatDate(invoice.due_date)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Company Address & Customer Address */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <p className="text-xs text-slate-500 mb-2">
                                {settings?.company_name}, {settings?.address}
                            </p>
                            <div className="border-b pb-4">
                                <p className="font-bold text-slate-900">{invoice.contact.name}</p>
                                {invoice.contact.address && (
                                    <p className="text-sm whitespace-pre-line">{invoice.contact.address}</p>
                                )}
                            </div>
                        </div>
                        <div className="text-right text-sm">
                            <p className="font-bold">{settings?.company_name}</p>
                            <p>{settings?.address}</p>
                            <p>Tel.: {settings?.phone}</p>
                            <p>{settings?.email}</p>
                        </div>
                    </div>

                    {/* Intro Text */}
                    <div className="mb-6">
                        <p className="text-sm">{invoice.intro_text}</p>
                    </div>

                    {/* Invoice Table */}
                    <table className="w-full mb-6 text-sm border-collapse">
                        <thead>
                            <tr className="border-b-2 border-slate-900">
                                <th className="text-left py-2 px-2">Pos.</th>
                                <th className="text-left py-2 px-2">Bezeichnung</th>
                                <th className="text-right py-2 px-2">Menge</th>
                                <th className="text-center py-2 px-2">Einheit</th>
                                <th className="text-right py-2 px-2">Einzel €</th>
                                <th className="text-right py-2 px-2">Gesamt €</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.lines.map((line, index) => (
                                <tr key={index} className="border-b border-slate-200">
                                    <td className="py-3 px-2">{index + 1}</td>
                                    <td className="py-3 px-2">
                                        <div className="font-medium">{line.description}</div>
                                    </td>
                                    <td className="text-right py-3 px-2">{line.quantity}</td>
                                    <td className="text-center py-3 px-2">{line.unit}</td>
                                    <td className="text-right py-3 px-2">{formatCurrency(line.unit_price)}</td>
                                    <td className="text-right py-3 px-2">{formatCurrency(line.line_total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div className="flex justify-end mb-8">
                        <div className="w-64 space-y-2 text-sm">
                            <div className="flex justify-between border-b pb-2">
                                <span>Zwischensumme (netto)</span>
                                <span>{formatCurrency(invoice.subtotal)}</span>
                            </div>
                            {invoice.lines.map((line, index) => (
                                line.tax_rate > 0 && (
                                    <div key={index} className="flex justify-between">
                                        <span>Umsatzsteuer {line.tax_rate}%</span>
                                        <span>{formatCurrency(Math.round(line.line_total * (line.tax_rate / 100)))}</span>
                                    </div>
                                )
                            ))}
                            <div className="flex justify-between font-bold text-base border-t-2 border-slate-900 pt-2">
                                <span>Gesamtbetrag</span>
                                <span>{formatCurrency(invoice.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="space-y-4 text-sm">
                        <p><strong>{invoice.payment_terms}</strong></p>
                        <p>{invoice.footer_note}</p>
                    </div>

                    {/* Company Footer */}
                    <div className="mt-12 pt-6 border-t border-slate-300 text-xs text-slate-600 grid grid-cols-3 gap-4">
                        <div>
                            <p className="font-bold">{settings?.company_name}</p>
                            <p>{settings?.address}</p>
                        </div>
                        <div className="text-center">
                            <p>Steuernummer: {settings?.tax_number}</p>
                        </div>
                        <div className="text-right">
                            <p>{settings?.email}</p>
                            <p>Tel.: {settings?.phone}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    body { margin: 0; padding: 0; }
                    @page { margin: 2cm; }
                }
            `}</style>
        </>
    );
}
