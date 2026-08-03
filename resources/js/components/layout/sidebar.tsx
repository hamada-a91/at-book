import { Link, useLocation, useParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import axios from "@/lib/axios"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
    LayoutDashboard,
    Users,
    FileText,
    Settings,
    Menu,
    BookOpen,
    Receipt,
    Landmark,
    WalletCards,
    FileCheck,
    ShoppingCart,
    Package,
    BarChart3,
    ChevronDown,
    ChevronRight,
    Layers,
    UserCog,
    Bug,
    Shield,
    History,
    FolderKanban,
    SlidersHorizontal,
    CircleDollarSign,
    LifeBuoy,
} from "lucide-react"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { SupportModal } from "@/components/SupportModal"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    onItemClick?: () => void;
}

export function Sidebar({ className, onItemClick }: SidebarProps) {
    const location = useLocation()
    const { tenant } = useParams()
    const pathname = location.pathname
    // Pro Kategorie: true/false = vom Nutzer umgeschaltet; undefined = Default
    // (aktive Kategorie offen, siehe renderGroup).
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
    const [supportOpen, setSupportOpen] = useState(false)

    const tenantUrl = (path: string) => {
        return tenant ? `/${tenant}${path}` : path
    }

    const isActive = (path: string) => {
        if (path === '/') {
            return pathname === `/${tenant}` || pathname === `/${tenant}/dashboard` || pathname === `/${tenant}/`
        }
        return pathname.startsWith(`/${tenant}${path}`)
    }


    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data } = await axios.get('/api/settings');
            return data;
        },
    });

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: async () => {
            const response = await axios.get('/api/user');
            return response.data.user;
        },
    });

    const isAdmin = currentUser?.roles?.some((role: any) => role.name === 'admin') || false;
    // Audit-Log ist nur für owner/buchhalter zugänglich (API liefert sonst 403)
    const canSeeAuditLog = currentUser?.roles?.some((role: any) => ['owner', 'buchhalter'].includes(role.name)) || false;
    const canSeeOpenItems = currentUser?.roles?.some(
        (role: any) => ['owner', 'manager', 'buchhalter'].includes(role.name)
    ) || false;
    const { data: openItemsNotification } = useQuery({
        queryKey: ['open-items', 'notification'],
        queryFn: async () => (await axios.get('/api/reports/open-items')).data,
        enabled: canSeeOpenItems,
        staleTime: 30_000,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });
    const openItemsCount = Array.isArray(openItemsNotification?.items)
        ? openItemsNotification.items.length
        : 0;



    // Einzel-Einträge (Hauptkategorien ohne Untermenü)
    const topLevelItems = [
        { label: "Dashboard", icon: LayoutDashboard, href: tenantUrl("/dashboard"), active: isActive("/dashboard") || isActive("/") },
        { label: "Journal & Berichte", icon: FileText, href: tenantUrl("/reports"), active: isActive("/reports") },
        { label: "Kontakte", icon: Users, href: tenantUrl("/contacts"), active: isActive("/contacts") },
        { label: "Bankkonten", icon: Landmark, href: tenantUrl("/bank-accounts"), active: isActive("/bank-accounts") },
    ]

    // Gruppen (aufklappbare Kategorien). Jedes Untermenü-Item hat ein eigenes
    // Icon. Leere Gruppen werden ausgeblendet.
    const groups: { key: string; label: string; icon: any; items: any[]; badge?: number }[] = [
        {
            key: "verkauf", label: "Verkauf", icon: ShoppingCart, items: [
                { label: "Angebote", icon: FileCheck, href: tenantUrl("/quotes"), active: isActive("/quotes") },
                { label: "Aufträge", icon: ShoppingCart, href: tenantUrl("/orders"), active: isActive("/orders") },
                { label: "Rechnungen", icon: FileText, href: tenantUrl("/invoices"), active: isActive("/invoices") },
            ],
        },
        {
            key: "buchhaltung", label: "Buchhaltung", icon: BookOpen, badge: canSeeOpenItems ? openItemsCount : 0, items: [
                { label: "Belege", icon: Receipt, href: tenantUrl("/belege"), active: isActive("/belege") },
                { label: "Banking", icon: WalletCards, href: tenantUrl("/banking"), active: isActive("/banking") },
                ...(canSeeOpenItems ? [{ label: "Offene Posten", icon: CircleDollarSign, href: tenantUrl("/open-items"), active: isActive("/open-items"), badge: openItemsCount }] : []),
                { label: "Buchungen", icon: BookOpen, href: tenantUrl("/bookings"), active: isActive("/bookings") },
                { label: "Sachkonten", icon: Layers, href: tenantUrl("/accounts"), active: isActive("/accounts") },
            ],
        },
        {
            key: "produkte", label: "Produkte", icon: Package, items: [
                { label: "Alle Produkte", icon: Package, href: tenantUrl("/products"), active: pathname === `/${tenant}/products` || pathname === `/${tenant}/products/create` },
                { label: "Lagerbestand", icon: BarChart3, href: tenantUrl("/products/movements"), active: isActive("/products/movements") },
            ],
        },
        {
            key: "controlling", label: "Controlling", icon: BarChart3, items: [
                ...(settings?.module_projects_enabled ? [{ label: "Projekte", icon: FolderKanban, href: tenantUrl("/projects"), active: isActive("/projects") }] : []),
                ...(settings?.module_cost_centers_enabled ? [{ label: "Kostenstellen", icon: SlidersHorizontal, href: tenantUrl("/cost-centers"), active: isActive("/cost-centers") }] : []),
            ],
        },
    ].filter((g) => g.items.length > 0)

    // Einstellungen-Gruppe (unten)
    const settingsGroup = {
        key: "einstellungen", label: "Einstellungen", icon: Settings, items: [
            { label: "Firmeneinstellungen", icon: Settings, href: tenantUrl("/settings"), active: isActive("/settings") },
            { label: "Benutzer", icon: UserCog, href: tenantUrl("/users"), active: isActive("/users") },
            ...(canSeeAuditLog ? [{ label: "Audit-Log", icon: History, href: tenantUrl("/audit-log"), active: isActive("/audit-log") }] : []),
            { label: "Meldungen", icon: Bug, href: tenantUrl("/bug-reports"), active: isActive("/bug-reports") },
        ],
    }

    const renderRouteButton = (route: any, isSubItem = false) => (
        <Button
            key={route.href}
            variant={route.active ? "secondary" : "ghost"}
            className={cn(
                "w-full justify-start text-base font-medium transition-all duration-200",
                isSubItem && "pl-10 text-sm",
                route.active
                    ? "bg-blue-600 dark:bg-blue-700 shadow-lg text-white hover:bg-blue-700 dark:hover:bg-blue-800 scale-[1.02]"
                    : "text-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-900 hover:text-blue-950 dark:hover:text-white"
            )}
            asChild
            onClick={onItemClick}
        >
            <Link to={route.href}>
                {route.icon && (
                    <route.icon className={cn(
                        "mr-3",
                        isSubItem ? "h-4 w-4" : "h-5 w-5",
                        route.active ? "text-white" : "text-blue-600 dark:text-blue-400"
                    )} />
                )}
                {route.label}
                {route.badge > 0 && (
                    <span className="ml-auto min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
                        {route.badge > 99 ? '99+' : route.badge}
                    </span>
                )}
            </Link>
        </Button>
    )

    // Aufklappbare Kategorie. Standardmäßig ist die Kategorie der AKTIVEN Seite
    // offen (expandedSections[key] überschreibt das, sobald der Nutzer klickt).
    const renderGroup = (group: { key: string; label: string; icon: any; items: any[]; badge?: number }) => {
        const groupActive = group.items.some((i) => i.active)
        const expanded = expandedSections[group.key] ?? groupActive
        const groupBadge = group.badge ?? 0
        return (
            <div key={group.key} className="space-y-1">
                <button
                    onClick={() => setExpandedSections((prev) => ({ ...prev, [group.key]: !expanded }))}
                    className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-base font-medium rounded-md transition-all duration-200",
                        groupActive ? "text-blue-900 dark:text-blue-100" : "text-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-900"
                    )}
                >
                    <div className="flex items-center">
                        <group.icon className="mr-3 h-5 w-5 text-blue-600 dark:text-blue-400" />
                        {group.label}
                    </div>
                    <div className="flex items-center gap-2">
                        {groupBadge > 0 && (
                            <span className="min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
                                {groupBadge > 99 ? '99+' : groupBadge}
                            </span>
                        )}
                        {expanded ? <ChevronDown className="h-4 w-4 text-blue-500" /> : <ChevronRight className="h-4 w-4 text-blue-500" />}
                    </div>
                </button>
                {expanded && (
                    <div className="space-y-1 ml-2">
                        {group.items.map((item) => renderRouteButton(item, true))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={cn("pb-24 md:pb-12 h-screen overflow-y-auto bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-950 dark:to-slate-950 border-r border-blue-200 dark:border-blue-900", className)}>
            <div className="space-y-4 py-4 flex flex-col h-full">
                <div className="px-3 py-2">
                    <div className="flex items-center mb-6 px-2">
                        {settings?.logo_path ? (
                            <img
                                src={`/storage/${settings.logo_path}`}
                                alt="Company Logo"
                                className="h-10 w-10 object-contain mr-3 rounded-lg"
                            />
                        ) : (
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mr-3 shadow-lg">
                                <BookOpen className="h-6 w-6 text-white" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
                                {settings?.company_name || 'AT-Book'}
                            </h2>
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Buchhaltung</p>
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="space-y-1">
                        {isAdmin ? (
                            renderRouteButton({
                                label: "Admin Panel",
                                icon: Shield,
                                href: "/admin/dashboard",
                                active: location.pathname.startsWith("/admin"),
                            })
                        ) : (
                            <>
                                {topLevelItems.map((item) => renderRouteButton(item))}
                                <div className="my-2 border-t border-blue-200 dark:border-blue-800" />
                                {groups.map((group) => renderGroup(group))}
                            </>
                        )}
                    </div>
                </div>

                <div className="px-3 py-2 mt-auto space-y-2">
                    {!isAdmin && (
                        <div className="border-t border-blue-200 dark:border-blue-800 pt-2">
                            {renderGroup(settingsGroup)}
                        </div>
                    )}
                    <div className="pt-2 border-t border-blue-200 dark:border-blue-800 flex justify-center">
                        <button
                            type="button"
                            onClick={() => setSupportOpen(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-blue-700 dark:text-blue-200 bg-blue-100/80 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-full transition-all duration-200 shadow-sm cursor-pointer"
                        >
                            <LifeBuoy className="h-4 w-4 animate-pulse text-blue-600 dark:text-blue-400" />
                            <span>Support kontaktieren</span>
                        </button>
                    </div>
                </div>
                <SupportModal open={supportOpen} onOpenChange={setSupportOpen} />
            </div>
        </div >
    )
}

export function MobileSidebar() {
    const [open, setOpen] = useState(false)

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" className="md:hidden">
                    <Menu />
                    <span className="sr-only">Toggle Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-950 dark:to-slate-950">
                <Sidebar className="w-full border-none" onItemClick={() => setOpen(false)} />
            </SheetContent>
        </Sheet>
    )
}
