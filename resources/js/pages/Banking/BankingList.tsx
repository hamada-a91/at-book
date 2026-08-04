import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import axios from "@/lib/axios"
import { formatCurrency } from "@/lib/currency"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { AccountSelector } from "@/components/AccountSelector"
import { ProjectSelector } from "@/components/ProjectSelector"
import { CostCenterSelector } from "@/components/CostCenterSelector"
import { Upload, Link2, Ban, RotateCcw, RefreshCw, Pencil, Save, X, Sparkles, Check, Receipt, FileText } from "lucide-react"

type BankAccount = { id: number; name: string; bank_name: string }
type Account = { id: number; code: string; name: string; type: string }
type Invoice = { id: number; invoice_number: string; total: number; amount_paid: number; contact?: { name: string } }
type Beleg = { id: number; document_number: string; amount: number; amount_paid: number; title: string }
type BankTransaction = {
    id: number
    bank_account_id?: number
    booking_date: string
    value_date?: string | null
    counterparty?: string | null
    purpose?: string | null
    amount: number
    currency: string
    status: "unmatched" | "matched" | "ignored"
    matched_type?: string | null
    notes?: string | null
}
type Suggestion = { target_type: "invoice" | "beleg" | "category"; target_id: number; score: number; reason: string; label?: string }
type EditTransaction = {
    booking_date: string
    value_date: string
    counterparty: string
    purpose: string
    amount: string
    currency: string
    notes: string
}

const mappingFields = [
    ["booking_date", "Buchungsdatum"],
    ["value_date", "Wertstellung"],
    ["counterparty", "Auftraggeber/Empfänger"],
    ["purpose", "Verwendungszweck"],
    ["amount", "Betrag"],
    ["debit", "Soll"],
    ["credit", "Haben"],
    ["currency", "Währung"],
]

const taxRateOptions = [
    { value: "0", label: "Keine", rate: 0 },
    { value: "19", label: "19% USt.", rate: 19 },
    { value: "7", label: "7% USt.", rate: 7 },
]

export function BankingList() {
    const navigate = useNavigate()
    const location = useLocation()
    const { tenant } = useParams<{ tenant: string }>()
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [belege, setBelege] = useState<Beleg[]>([])
    const [transactions, setTransactions] = useState<BankTransaction[]>([])
    const [suggestions, setSuggestions] = useState<Array<{ transaction: BankTransaction; suggestions: Suggestion[] }>>([])
    const [selectedTx, setSelectedTx] = useState<BankTransaction | null>(null)
    const [status, setStatus] = useState<string>("unmatched")
    const [bankAccountId, setBankAccountId] = useState<string>("")
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<any>(null)
    const [mapping, setMapping] = useState<Record<string, string>>({})
    const [delimiter, setDelimiter] = useState(";")
    const [message, setMessage] = useState<string>("")
    const [targetType, setTargetType] = useState<"invoice" | "beleg" | "category">("invoice")
    const [targetId, setTargetId] = useState<string>("")
    const [categoryAccountId, setCategoryAccountId] = useState<string>("")
    const [categoryAmount, setCategoryAmount] = useState<string>("")
    const [categoryTaxRate, setCategoryTaxRate] = useState<string>("0")
    const [categoryNote, setCategoryNote] = useState<string>("")
    const [categoryProjectId, setCategoryProjectId] = useState<string | undefined>()
    const [categoryCostCenterId, setCategoryCostCenterId] = useState<string | undefined>()
    const [editingTxId, setEditingTxId] = useState<number | null>(null)
    const [editTx, setEditTx] = useState<EditTransaction | null>(null)

    useEffect(() => {
        loadBaseData()
    }, [])

    useEffect(() => {
        loadTransactions()
    }, [])

    useEffect(() => {
        if (!selectedTx) return
        setCategoryAmount(centsToInput(Math.abs(selectedTx.amount)))
        setCategoryTaxRate("0")
        setCategoryNote(selectedTx.purpose || "")
        setCategoryProjectId(undefined)
        setCategoryCostCenterId(undefined)
    }, [selectedTx?.id])

    const openInvoices = useMemo(
        () => invoices.filter((invoice) => Number(invoice.total) > Number(invoice.amount_paid)),
        [invoices]
    )
    const openBelege = useMemo(
        () => belege.filter((beleg) => Number(beleg.amount) > Number(beleg.amount_paid)),
        [belege]
    )
    const categoryAccounts = useMemo(() => {
        // Eigenkapital (equity) immer erlaubt – z.B. Privateinlage/Kapitalrücklage
        // bei Geldeingang, Privatentnahme bei Geldabgang.
        if (!selectedTx) {
            return accounts.filter((account) => ["expense", "revenue", "equity"].includes(account.type))
        }
        const allowed = selectedTx.amount < 0 ? ["expense", "equity"] : ["revenue", "equity"]

        return accounts.filter((account) => allowed.includes(account.type))
    }, [accounts, selectedTx?.amount])
    const suggestionByTransactionId = useMemo(() => {
        const map = new Map<number, Suggestion>()
        suggestions.forEach((item) => {
            if (item.suggestions[0]) {
                map.set(item.transaction.id, item.suggestions[0])
            }
        })
        return map
    }, [suggestions])
    const selectedSuggestions = selectedTx ? suggestions.find((item) => item.transaction.id === selectedTx.id)?.suggestions ?? [] : []

    const loadBaseData = async () => {
        const [bankAccountRes, accountRes, invoiceRes, belegRes] = await Promise.all([
            axios.get("/api/bank-accounts"),
            axios.get("/api/accounts"),
            axios.get("/api/invoices"),
            axios.get("/api/belege"),
        ])
        setBankAccounts(bankAccountRes.data)
        setAccounts(accountRes.data)
        setInvoices(invoiceRes.data)
        setBelege(belegRes.data)
        if (bankAccountRes.data[0]) {
            setBankAccountId(String(bankAccountRes.data[0].id))
        }
        await loadSuggestions()
    }

    const loadTransactions = async () => {
        const { data } = await axios.get("/api/bank-transactions", { params: { per_page: 250 } })
        setTransactions(data.data ?? data)
    }

    const loadSuggestions = async () => {
        const { data } = await axios.get("/api/bank-transactions/suggestions")
        setSuggestions(data)
    }

    const previewImport = async () => {
        if (!file || !bankAccountId) return
        const form = new FormData()
        form.append("file", file)
        form.append("bank_account_id", bankAccountId)
        const { data } = await axios.post("/api/bank-imports/preview", form)
        setPreview(data)
        setDelimiter(data.delimiter || ";")
        setMapping(data.mapping_suggestion || {})
        setMessage("")
    }

    const runImport = async () => {
        if (!file || !bankAccountId) return
        const form = new FormData()
        form.append("file", file)
        form.append("bank_account_id", bankAccountId)
        form.append("settings", JSON.stringify({ delimiter, encoding: preview?.encoding || "UTF-8", mapping }))
        const { data } = await axios.post("/api/bank-imports", form)
        setMessage(`${data.imported} importiert, ${data.skipped} übersprungen`)
        setPreview(null)
        setStatus("all")
        await Promise.all([loadTransactions(), loadSuggestions()])
    }

    const assignSuggestions = async () => {
        const { data } = await axios.post("/api/bank-transactions/assign-suggestions")
        setMessage(`${data.assigned} Vorschläge übernommen`)
        await Promise.all([loadBaseData(), loadTransactions(), loadSuggestions()])
    }

    const assign = async (tx = selectedTx, suggestion?: Suggestion) => {
        if (!tx) return
        const payload = suggestion
            ? suggestion.target_type === "category"
                ? { target_type: "category", account_id: suggestion.target_id }
                : { target_type: suggestion.target_type, target_id: suggestion.target_id }
            : targetType === "category"
                ? categoryPayload(tx)
                : { target_type: targetType, target_id: Number(targetId), note: categoryNote || undefined }

        await axios.post(`/api/bank-transactions/${tx.id}/assign`, payload)
        setSelectedTx(null)
        setTargetId("")
        setCategoryAccountId("")
        await Promise.all([loadBaseData(), loadTransactions(), loadSuggestions()])
    }

    const categoryPayload = (tx: BankTransaction) => {
        const gross = Math.abs(tx.amount)
        const taxRate = Number(categoryTaxRate)
        const taxAmount = taxRate > 0 ? Math.round(gross * taxRate / (100 + taxRate)) : 0
        const taxAccountId = taxAmount > 0 ? resolveTaxAccountId(tx, taxRate) : undefined

        return {
            target_type: "category",
            account_id: Number(categoryAccountId),
            tax_amount: taxAmount,
            tax_account_id: taxAccountId,
            project_id: categoryProjectId ? Number(categoryProjectId) : undefined,
            cost_center_id: categoryCostCenterId ? Number(categoryCostCenterId) : undefined,
            note: categoryNote || undefined,
        }
    }

    const resolveTaxAccountId = (tx: BankTransaction, taxRate: number) => {
        const codes = tx.amount < 0
            ? taxRate === 19 ? ["1576", "1406", "1570"] : ["1571", "1401"]
            : taxRate === 19 ? ["1776", "3806", "1770"] : ["1771", "3801"]
        const byCode = accounts.find((account) => codes.includes(String(account.code)))
        if (byCode) return byCode.id
        const byName = accounts.find((account) => account.name.toLowerCase().includes("steuer") && account.type === "liability")
        return byName?.id
    }

    const ignore = async (tx: BankTransaction) => {
        await axios.post(`/api/bank-transactions/${tx.id}/ignore`)
        await Promise.all([loadTransactions(), loadSuggestions()])
    }

    const unassign = async (tx: BankTransaction) => {
        await axios.post(`/api/bank-transactions/${tx.id}/unassign`)
        await Promise.all([loadBaseData(), loadTransactions(), loadSuggestions()])
    }

    const startEdit = (tx: BankTransaction) => {
        setEditingTxId(tx.id)
        setEditTx({
            booking_date: dateInput(tx.booking_date),
            value_date: dateInput(tx.value_date),
            counterparty: tx.counterparty || "",
            purpose: tx.purpose || "",
            amount: centsToInput(tx.amount),
            currency: tx.currency || "EUR",
            notes: tx.notes || "",
        })
    }

    const saveEdit = async (tx: BankTransaction) => {
        if (!editTx) return
        await axios.patch(`/api/bank-transactions/${tx.id}`, {
            booking_date: editTx.booking_date,
            value_date: editTx.value_date || null,
            counterparty: editTx.counterparty || null,
            purpose: editTx.purpose || null,
            amount: euroInputToCents(editTx.amount),
            currency: editTx.currency || "EUR",
            notes: editTx.notes || null,
        })
        setEditingTxId(null)
        setEditTx(null)
        await Promise.all([loadTransactions(), loadSuggestions()])
    }

    const cancelEdit = () => {
        setEditingTxId(null)
        setEditTx(null)
    }

    const createFromTransaction = (type: "beleg" | "invoice") => {
        if (!selectedTx || !tenant) return
        const params = new URLSearchParams({
            bank_transaction_id: String(selectedTx.id),
            return_to: location.pathname,
        })
        const path = type === "beleg" ? "belege/create" : "invoices/create"
        navigate(`/${tenant}/${path}?${params.toString()}`, {
            state: { bankTransaction: selectedTx, returnTo: location.pathname },
        })
    }

    const renderAmount = (amount: number) => (
        <span className={amount < 0 ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>
            {formatCurrency(amount / 100)}
        </span>
    )

    const renderSuggestion = (tx: BankTransaction) => {
        const suggestion = suggestionByTransactionId.get(tx.id)
        if (!suggestion || tx.status !== "unmatched") return <span className="text-muted-foreground">-</span>

        return (
            <div className="flex min-w-[180px] items-center gap-2 rounded-md bg-sky-50 px-2 py-1 text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                <Sparkles className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{suggestion.label || suggestion.target_type}</div>
                    <div className="truncate text-xs text-sky-700 dark:text-sky-300">{suggestion.score}% · {suggestion.reason}</div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Vorschlag übernehmen" onClick={() => assign(tx, suggestion)}>
                    <Check className="h-4 w-4" />
                </Button>
            </div>
        )
    }

    const renderTransactionTable = (rows: BankTransaction[]) => (
        <div className="w-full overflow-x-auto">
            <Table className="min-w-[980px] table-fixed">
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead className="w-28">Datum</TableHead>
                        <TableHead className="w-[18%]">Gegenpartei</TableHead>
                        <TableHead className="w-[24%]">Verwendungszweck</TableHead>
                        <TableHead className="w-28 text-right">Betrag</TableHead>
                        <TableHead className="w-[22%]">Vorschlag</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead className="w-32"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((tx, index) => {
                        const isEditing = editingTxId === tx.id && editTx
                        return (
                            <TableRow key={tx.id} className={selectedTx?.id === tx.id ? "bg-muted/40" : undefined}>
                                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                <TableCell>
                                    {isEditing ? (
                                        <Input type="date" value={editTx.booking_date} onChange={(event) => setEditTx({ ...editTx, booking_date: event.target.value })} />
                                    ) : new Date(tx.booking_date).toLocaleDateString("de-DE")}
                                </TableCell>
                                <TableCell>
                                    {isEditing ? (
                                        <Input value={editTx.counterparty} onChange={(event) => setEditTx({ ...editTx, counterparty: event.target.value })} />
                                    ) : <span className="block truncate">{tx.counterparty || "-"}</span>}
                                </TableCell>
                                <TableCell>
                                    {isEditing ? (
                                        <Textarea rows={2} value={editTx.purpose} onChange={(event) => setEditTx({ ...editTx, purpose: event.target.value })} />
                                    ) : <span className="block truncate" title={tx.purpose || ""}>{tx.purpose || "-"}</span>}
                                </TableCell>
                                <TableCell className="text-right">
                                    {isEditing ? (
                                        <Input className="text-right" value={editTx.amount} onChange={(event) => setEditTx({ ...editTx, amount: event.target.value })} />
                                    ) : renderAmount(tx.amount)}
                                </TableCell>
                                <TableCell>{renderSuggestion(tx)}</TableCell>
                                <TableCell><Badge variant={tx.status === "matched" ? "default" : tx.status === "ignored" ? "secondary" : "outline"}>{statusLabel(tx.status)}</Badge></TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-1">
                                        {isEditing ? (
                                            <>
                                                <Button size="icon" variant="ghost" title="Speichern" onClick={() => saveEdit(tx)}><Save className="h-4 w-4" /></Button>
                                                <Button size="icon" variant="ghost" title="Abbrechen" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                                            </>
                                        ) : (
                                            <>
                                                {tx.status !== "matched" && (
                                                    <Button size="icon" variant="ghost" title="Bearbeiten" onClick={() => startEdit(tx)}><Pencil className="h-4 w-4" /></Button>
                                                )}
                                                {tx.status === "unmatched" && (
                                                    <>
                                                        <Button size="icon" variant="ghost" title="Zuordnen" onClick={() => setSelectedTx(tx)}><Link2 className="h-4 w-4" /></Button>
                                                        <Button size="icon" variant="ghost" title="Ignorieren" onClick={() => ignore(tx)}><Ban className="h-4 w-4" /></Button>
                                                    </>
                                                )}
                                                {tx.status === "matched" && (
                                                    <Button size="icon" variant="ghost" title="Zuordnung aufheben" onClick={() => unassign(tx)}><RotateCcw className="h-4 w-4" /></Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )

    const categoryTaxAccountMissing = selectedTx && categoryTaxRate !== "0" && !resolveTaxAccountId(selectedTx, Number(categoryTaxRate))

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Banking</h1>
                    <p className="text-muted-foreground">Kontoauszüge importieren, offene Umsätze zuordnen und Vorschläge prüfen.</p>
                </div>
                <Button variant="outline" onClick={() => Promise.all([loadTransactions(), loadSuggestions()])}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Aktualisieren
                </Button>
            </div>

            <div className={selectedTx ? "grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]" : "grid min-w-0 gap-4"}>
                <div className="min-w-0 rounded-lg border bg-background p-4">
                    <Tabs defaultValue="suggestions">
                        <TabsList>
                            <TabsTrigger value="suggestions">Vorschläge</TabsTrigger>
                            <TabsTrigger value="unmatched">Zuzuordnen</TabsTrigger>
                            <TabsTrigger value="all">Alle Umsätze</TabsTrigger>
                            <TabsTrigger value="import">Import</TabsTrigger>
                        </TabsList>
                        <TabsContent value="suggestions" className="mt-4 space-y-3">
                            {suggestions.length > 0 && (
                                <div className="flex justify-end">
                                    <Button variant="outline" onClick={assignSuggestions}>Alle sicheren Vorschläge übernehmen</Button>
                                </div>
                            )}
                            {suggestions.map((item) => (
                                <div key={item.transaction.id} className="rounded-md border p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="font-medium">{item.transaction.counterparty || item.transaction.purpose}</div>
                                            <div className="text-sm text-muted-foreground">{renderAmount(item.transaction.amount)} · {item.transaction.purpose}</div>
                                        </div>
                                        <Button onClick={() => assign(item.transaction, item.suggestions[0])}>
                                            <Link2 className="mr-2 h-4 w-4" /> Übernehmen
                                        </Button>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {item.suggestions.map((suggestion) => (
                                            <Badge key={`${suggestion.target_type}-${suggestion.target_id}`} variant="outline">
                                                {suggestion.target_type} · {suggestion.score}% · {suggestion.reason}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {suggestions.length === 0 && <p className="text-sm text-muted-foreground">Keine Vorschläge vorhanden.</p>}
                        </TabsContent>
                        <TabsContent value="unmatched" className="mt-4">{renderTransactionTable(transactions.filter((tx) => tx.status === "unmatched"))}</TabsContent>
                        <TabsContent value="all" className="mt-4 space-y-3">
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Alle</SelectItem>
                                    <SelectItem value="unmatched">Offen</SelectItem>
                                    <SelectItem value="matched">Zugeordnet</SelectItem>
                                    <SelectItem value="ignored">Ignoriert</SelectItem>
                                </SelectContent>
                            </Select>
                            {renderTransactionTable(status === "all" ? transactions : transactions.filter((tx) => tx.status === status))}
                        </TabsContent>
                        <TabsContent value="import" className="mt-4 space-y-4">
                            <div className="grid gap-3 md:grid-cols-3">
                                <div>
                                    <Label>Bankkonto</Label>
                                    <Select value={bankAccountId} onValueChange={setBankAccountId}>
                                        <SelectTrigger><SelectValue placeholder="Bankkonto" /></SelectTrigger>
                                        <SelectContent>
                                            {bankAccounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-2">
                                    <Label>CSV-Datei</Label>
                                    <Input type="file" accept=".csv,.txt" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={previewImport} disabled={!file || !bankAccountId}>Vorschau</Button>
                                <Button onClick={runImport} disabled={!preview}><Upload className="mr-2 h-4 w-4" /> Importieren</Button>
                            </div>
                            {message && <p className="text-sm font-medium">{message}</p>}
                            {preview && (
                                <div className="space-y-4">
                                    <div className="grid gap-3 md:grid-cols-3">
                                        <div>
                                            <Label>Trennzeichen</Label>
                                            <Input value={delimiter} onChange={(event) => setDelimiter(event.target.value)} />
                                        </div>
                                        {mappingFields.map(([field, label]) => (
                                            <div key={field}>
                                                <Label>{label}</Label>
                                                <Select value={mapping[field] || "-"} onValueChange={(value) => setMapping((prev) => ({ ...prev, [field]: value === "-" ? "" : value }))}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="-">Nicht verwenden</SelectItem>
                                                        {preview.headers.map((header: string) => <SelectItem key={header} value={header}>{header}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </div>
                                    {renderTransactionPreview(preview.rows)}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>

                {selectedTx && (
                    <div className="rounded-lg border bg-background p-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Umsatz zuordnen</h2>
                            <Button size="icon" variant="ghost" title="Panel schließen" onClick={() => setSelectedTx(null)}><X className="h-4 w-4" /></Button>
                        </div>
                        <div className="mt-4 space-y-4">
                            <div className="rounded-md bg-muted p-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="font-medium">{selectedTx.counterparty || "-"}</div>
                                    <div>{renderAmount(selectedTx.amount)}</div>
                                </div>
                                <div className="mt-1 text-muted-foreground">{selectedTx.purpose || "-"}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{new Date(selectedTx.booking_date).toLocaleDateString("de-DE")}</div>
                            </div>

                            {selectedSuggestions.length > 0 ? (
                                <div className="space-y-2">
                                    <Label>Vorschläge</Label>
                                    {selectedSuggestions.map((suggestion) => (
                                        <Button key={`${suggestion.target_type}-${suggestion.target_id}`} variant="outline" className="w-full justify-between" onClick={() => assign(selectedTx, suggestion)}>
                                            <span className="truncate"><Sparkles className="mr-2 inline h-4 w-4" />{suggestion.label || suggestion.target_type}</span>
                                            <span className="text-muted-foreground">{suggestion.score}%</span>
                                        </Button>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-md border border-dashed p-3">
                                    <div className="text-sm font-medium">Kein Treffer gefunden</div>
                                    <div className="mt-3 grid gap-2">
                                        <Button variant="outline" onClick={() => createFromTransaction("beleg")}>
                                            <Receipt className="mr-2 h-4 w-4" /> Neuer Beleg aus Umsatz
                                        </Button>
                                        <Button variant="outline" onClick={() => createFromTransaction("invoice")} disabled={selectedTx.amount <= 0} title={selectedTx.amount <= 0 ? "Rechnung passt nur zu Zahlungseingängen." : undefined}>
                                            <FileText className="mr-2 h-4 w-4" /> Neue Rechnung aus Umsatz
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div>
                                <Label>Ziel</Label>
                                <Select value={targetType} onValueChange={(value: any) => { setTargetType(value); setTargetId(""); setCategoryAccountId("") }}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="invoice">Rechnung</SelectItem>
                                        <SelectItem value="beleg">Beleg</SelectItem>
                                        <SelectItem value="category">Kategorie</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {targetType === "invoice" && (
                                <Select value={targetId} onValueChange={setTargetId}>
                                    <SelectTrigger><SelectValue placeholder="Rechnung wählen" /></SelectTrigger>
                                    <SelectContent>{openInvoices.map((invoice) => <SelectItem key={invoice.id} value={String(invoice.id)}>{invoice.invoice_number} · {formatCurrency((invoice.total - invoice.amount_paid) / 100)}</SelectItem>)}</SelectContent>
                                </Select>
                            )}
                            {targetType === "beleg" && (
                                <Select value={targetId} onValueChange={setTargetId}>
                                    <SelectTrigger><SelectValue placeholder="Beleg wählen" /></SelectTrigger>
                                    <SelectContent>{openBelege.map((beleg) => <SelectItem key={beleg.id} value={String(beleg.id)}>{beleg.document_number} · {formatCurrency((beleg.amount - beleg.amount_paid) / 100)}</SelectItem>)}</SelectContent>
                                </Select>
                            )}
                            {targetType === "category" && (
                                <div className="space-y-3">
                                    <div>
                                        <Label>Kategorie</Label>
                                        <AccountSelector
                                            accounts={categoryAccounts}
                                            value={categoryAccountId}
                                            onChange={setCategoryAccountId}
                                            placeholder="Sachkonto suchen..."
                                        />
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            Bei Ausgaben werden Aufwandskonten gezeigt, bei Einnahmen Erlöskonten.
                                        </p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div>
                                            <Label>Steuer</Label>
                                            <Select value={categoryTaxRate} onValueChange={setCategoryTaxRate}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>{taxRateOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Betrag in EUR</Label>
                                            <Input className="text-right bg-muted/40" value={categoryAmount} readOnly />
                                        </div>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div>
                                            <Label>Projekt optional</Label>
                                            <ProjectSelector value={categoryProjectId} onChange={setCategoryProjectId} />
                                        </div>
                                        <div>
                                            <Label>Kostenstelle optional</Label>
                                            <CostCenterSelector value={categoryCostCenterId} onChange={setCategoryCostCenterId} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Notiz</Label>
                                        <Textarea rows={3} value={categoryNote} onChange={(event) => setCategoryNote(event.target.value)} />
                                    </div>
                                    {categoryTaxAccountMissing && <p className="text-sm text-red-600">Für diesen Steuersatz wurde kein Steuerkonto gefunden.</p>}
                                </div>
                            )}
                            <Button className="w-full" onClick={() => assign()} disabled={targetType === "category" ? !categoryAccountId || !!categoryTaxAccountMissing : !targetId}>Zuordnen</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function renderTransactionPreview(rows: Array<Record<string, string>>) {
    const headers = rows[0] ? Object.keys(rows[0]) : []
    return (
        <div className="overflow-x-auto rounded-md border">
            <Table>
                <TableHeader><TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                    {rows.slice(0, 8).map((row, index) => (
                        <TableRow key={index}>{headers.map((header) => <TableCell key={header}>{row[header]}</TableCell>)}</TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

function dateInput(value?: string | null) {
    return value ? value.split("T")[0] : ""
}

function centsToInput(cents: number) {
    return (cents / 100).toFixed(2).replace(".", ",")
}

function euroInputToCents(value: string) {
    const normalized = value.trim().replace(/\s/g, "")
    const decimal = normalized.includes(",") ? normalized.replace(/\./g, "").replace(",", ".") : normalized
    return Math.round(Number(decimal || 0) * 100)
}

function statusLabel(status: BankTransaction["status"]) {
    if (status === "matched") return "Zugeordnet"
    if (status === "ignored") return "Ignoriert"
    return "Offen"
}
