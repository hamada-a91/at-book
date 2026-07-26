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
} from "lucide-react"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

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


    // Einzel-Einträge oben
    const dashboardItem = {
        label: "Dashboard", icon: LayoutDashboard, href: tenantUrl("/dashboard"),
        active: isActive("/dashboard") || isActive("/"),
    }
    const kontakteItem = {
        label: "Kontakte", icon: Users, href: tenantUrl("/contacts"), active: isActive("/contacts"),
    }

    // Gruppen (aufklappbare Kategorien). Leere Gruppen werden ausgeblendet.
    const groups: { key: string; label: string; icon: any; items: any[] }[] = [
        {
            key: "verkauf", label: "Verkauf", icon: ShoppingCart, items: [
                { label: "Angebote", href: tenantUrl("/quotes"), active: isActive("/quotes") },
                { label: "Aufträge", href: tenantUrl("/orders"), active: isActive("/orders") },
                { label: "Rechnungen", href: tenantUrl("/invoices"), active: isActive("/invoices") },
            ],
        },
        {
            key: "buchhaltung", label: "Buchhaltung", icon: BookOpen, items: [
                { label: "Belege", href: tenantUrl("/belege"), active: isActive("/belege") },
                { label: "Buchungen", href: tenantUrl("/bookings"), active: isActive("/bookings") },
                { label: "Journal & Berichte", href: tenantUrl("/reports"), active: isActive("/reports") },
                { label: "Sachkonten", href: tenantUrl("/accounts"), active: isActive("/accounts") },
                { label: "Bankkonten", href: tenantUrl("/bank-accounts"), active: isActive("/bank-accounts") },
            ],
        },
        {
            key: "produkte", label: "Produkte", icon: Package, items: [
                { label: "Alle Produkte", href: tenantUrl("/products"), active: pathname === `/${tenant}/products` || pathname === `/${tenant}/products/create` },
                { label: "Lagerbestand", href: tenantUrl("/products/movements"), active: isActive("/products/movements") },
            ],
        },
        {
            key: "controlling", label: "Controlling", icon: BarChart3, items: [
                ...(settings?.module_projects_enabled ? [{ label: "Projekte", href: tenantUrl("/projects"), active: isActive("/projects") }] : []),
                ...(settings?.module_cost_centers_enabled ? [{ label: "Kostenstellen", href: tenantUrl("/cost-centers"), active: isActive("/cost-centers") }] : []),
            ],
        },
    ].filter((g) => g.items.length > 0)

    // Einstellungen-Gruppe (unten)
    const settingsGroup = {
        key: "einstellungen", label: "Einstellungen", icon: Settings, items: [
            { label: "Firmeneinstellungen", href: tenantUrl("/settings"), active: isActive("/settings") },
            { label: "Benutzer", href: tenantUrl("/users"), active: isActive("/users") },
            ...(canSeeAuditLog ? [{ label: "Audit-Log", href: tenantUrl("/audit-log"), active: isActive("/audit-log") }] : []),
            { label: "Meldungen", href: tenantUrl("/bug-reports"), active: isActive("/bug-reports") },
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
                {!isSubItem && route.icon && <route.icon className={cn("mr-3 h-5 w-5", route.active ? "text-white" : "text-blue-600 dark:text-blue-400")} />}
                {isSubItem && <span className="mr-3 h-5 w-5 flex items-center justify-center text-xs">•</span>}
                {route.label}
            </Link>
        </Button>
    )

    // Aufklappbare Kategorie. Standardmäßig ist die Kategorie der AKTIVEN Seite
    // offen (expandedSections[key] überschreibt das, sobald der Nutzer klickt).
    const renderGroup = (group: { key: string; label: string; icon: any; items: any[] }) => {
        const groupActive = group.items.some((i) => i.active)
        const expanded = expandedSections[group.key] ?? groupActive
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
                    {expanded ? <ChevronDown className="h-4 w-4 text-blue-500" /> : <ChevronRight className="h-4 w-4 text-blue-500" />}
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
                                {renderRouteButton(dashboardItem)}
                                {renderRouteButton(kontakteItem)}
                                <div className="my-2 border-t border-blue-200 dark:border-blue-800" />
                                {groups.map((group) => renderGroup(group))}
                            </>
                        )}
                    </div>
                </div>

                {!isAdmin && (
                    <div className="px-3 py-2 mt-auto">
                        <div className="border-t border-blue-200 dark:border-blue-800 pt-2">
                            {renderGroup(settingsGroup)}
                        </div>
                    </div>
                )}
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
