import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';

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
    street?: string;
    zip?: string;
    city?: string;
    country?: string;
    email: string;
    phone: string;
    tax_number: string;
    logo_path?: string;
}

interface BankAccount {
    id: number;
    name: string;
    bank_name: string;
    iban: string;
    bic: string | null;
    formatted_iban: string;
    is_default: boolean;
}

export function InvoicePreview() {
    const { tenant, id } = useParams();
    const navigate = useNavigate();
    const [isPrinting, setIsPrinting] = useState(false);

    const { data: invoice, isLoading } = useQuery<Invoice>({
        queryKey: ['invoice', id],
        queryFn: async () => {
            const { data } = await axios.get(`/api/invoices/${id}`);
            return data;
        },
    });

    const { data: settings } = useQuery<CompanySetting>({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data } = await axios.get('/api/settings');
            return data;
        },
    });

    const { data: bankAccounts } = useQuery<BankAccount[]>({
        queryKey: ['bank-accounts'],
        queryFn: async () => {
            const { data } = await axios.get('/api/bank-accounts');
            return data;
        },
    });

    // Get default bank account
    const defaultBankAccount = bankAccounts?.find(account => account.is_default) || bankAccounts?.[0];

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

    const handleDownloadPDF = async () => {
        try {
            const response = await axios.get(`/api/invoices/${id}/pdf`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `invoice-${invoice?.invoice_number || id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Fehler beim Herunterladen der PDF');
        }
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
                        <Button variant="outline" size="sm" onClick={() => navigate(`/${tenant}/invoices`)}>
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
                            {settings?.logo_path && (
                                <img
                                    src={`/storage/${settings.logo_path}`}
                                    alt={`${settings.company_name} Logo`}
                                    className="h-16 mb-4 object-contain"
                                />
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
                                {settings?.company_name}, {settings?.street}, {settings?.zip} {settings?.city}
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
                            {settings?.street && <p>{settings.street}</p>}
                            {(settings?.zip || settings?.city) && (
                                <p>{settings?.zip} {settings?.city}</p>
                            )}
                            {settings?.country && <p>{settings.country}</p>}
                            {settings?.phone && <p>Tel.: {settings.phone}</p>}
                            {settings?.email && <p>E-Mail: {settings.email}</p>}
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

                    {/* Company Footer with Bank Details and Tax Number */}
                    <div className="mt-12 pt-6 border-t border-slate-300 text-xs text-slate-600">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <p className="font-bold mb-1">{settings?.company_name}</p>
                                {settings?.street && <p>{settings.street}</p>}
                                {(settings?.zip || settings?.city) && (
                                    <p>{settings?.zip} {settings?.city}</p>
                                )}
                                {settings?.country && <p>{settings.country}</p>}
                            </div>
                            <div className="text-center">
                                {settings?.tax_number && (
                                    <>
                                        <p className="font-semibold">Steuernummer</p>
                                        <p>{settings.tax_number}</p>
                                    </>
                                )}
                                {defaultBankAccount && (
                                    <div className="mt-2">
                                        <p className="font-semibold">Bankverbindung</p>
                                        <p>{defaultBankAccount.bank_name}</p>
                                        <p>IBAN: {defaultBankAccount.formatted_iban}</p>
                                        {defaultBankAccount.bic && <p>BIC: {defaultBankAccount.bic}</p>}
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="font-semibold mb-1">Kontakt</p>
                                {settings?.email && <p>{settings.email}</p>}
                                {settings?.phone && <p>Tel.: {settings.phone}</p>}
                            </div>
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
