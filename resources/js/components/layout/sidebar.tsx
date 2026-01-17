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
} from "lucide-react"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const location = useLocation()
    const { tenant } = useParams()
    const pathname = location.pathname
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        products: true, // Default expanded
    })

    const tenantUrl = (path: string) => {
        return tenant ? `/${tenant}${path}` : path
    }

    const isActive = (path: string) => {
        if (path === '/') {
            return pathname === `/${tenant}` || pathname === `/${tenant}/dashboard` || pathname === `/${tenant}/`
        }
        return pathname.startsWith(`/${tenant}${path}`)
    }

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
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


    // Routes grouped by category
    const mainRoutes = [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            href: tenantUrl("/dashboard"),
            active: isActive("/dashboard") || isActive("/"),
        },
        {
            label: "Buchungen",
            icon: BookOpen,
            href: tenantUrl("/bookings"),
            active: isActive("/bookings"),
        },
        {
            label: "Sachkonten",
            icon: Layers,
            href: tenantUrl("/accounts"),
            active: isActive("/accounts"),
        },
        {
            label: "Bankkonten",
            icon: Landmark,
            href: tenantUrl("/bank-accounts"),
            active: isActive("/bank-accounts"),
        },
        {
            label: "Journal & Berichte",
            icon: FileText,
            href: tenantUrl("/reports"),
            active: isActive("/reports"),
        },
        {
            label: "Kontakte",
            icon: Users,
            href: tenantUrl("/contacts"),
            active: isActive("/contacts"),
        },
        {
            label: "Benutzer",
            icon: UserCog,
            href: tenantUrl("/users"),
            active: isActive("/users"),
        },
        {
            label: "Meldungen",
            icon: Bug,
            href: tenantUrl("/bug-reports"),
            active: isActive("/bug-reports"),
        },
        // Admin Link - Only visible if user has admin role (need to check role)
        // For now, we'll verify checking userService or similar, but simplified:
        {
            label: "Admin Panel",
            icon: Shield,
            href: "/admin/dashboard", // Global route
            active: location.pathname.startsWith("/admin"),
        }
    ]


    // Products section with sub-items
    const productsSection = {
        label: "Produkte",
        icon: Package,
        expanded: expandedSections.products,
        active: isActive("/products"),
        items: [
            {
                label: "Alle Produkte",
                href: tenantUrl("/products"),
                active: pathname === `/${tenant}/products` || pathname === `/${tenant}/products/create`,
            },
            {
                label: "Lagerbestand",
                href: tenantUrl("/products/movements"),
                active: isActive("/products/movements"),
            },
        ]
    }

    // Sales/Documents routes
    const salesRoutes = [
        {
            label: "Angebote",
            icon: FileCheck,
            href: tenantUrl("/quotes"),
            active: isActive("/quotes"),
        },
        {
            label: "Aufträge",
            icon: ShoppingCart,
            href: tenantUrl("/orders"),
            active: isActive("/orders"),
        },
        {
            label: "Rechnungen",
            icon: FileText,
            href: tenantUrl("/invoices"),
            active: isActive("/invoices"),
        },
        {
            label: "Belege",
            icon: Receipt,
            href: tenantUrl("/belege"),
            active: isActive("/belege"),
        },
    ]

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
        >
            <Link to={route.href}>
                {!isSubItem && route.icon && <route.icon className={cn("mr-3 h-5 w-5", route.active ? "text-white" : "text-blue-600 dark:text-blue-400")} />}
                {isSubItem && <span className="mr-3 h-5 w-5 flex items-center justify-center text-xs">•</span>}
                {route.label}
            </Link>
        </Button>
    )

    return (
        <div className={cn("pb-12 h-screen overflow-y-auto bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-950 dark:to-slate-950 border-r border-blue-200 dark:border-blue-900", className)}>
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

                    {/* Main Routes */}
                    <div className="space-y-1">
                        {isAdmin ? (
                            // Admin only sees Admin Panel
                            renderRouteButton({
                                label: "Admin Panel",
                                icon: Shield,
                                href: "/admin/dashboard",
                                active: location.pathname.startsWith("/admin"),
                            })
                        ) : (
                            // Regular users see all tenant routes except Admin Panel
                            mainRoutes
                                .filter(route => route.label !== 'Admin Panel')
                                .map((route) => renderRouteButton(route))
                        )}

                        {/* Products Section with Sub-items */}
                        {!isAdmin && (
                            <div className="space-y-1">
                                <button
                                    onClick={() => toggleSection('products')}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 text-base font-medium rounded-md transition-all duration-200",
                                        productsSection.active
                                            ? "bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100"
                                            : "text-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-900"
                                    )}
                                >
                                    <div className="flex items-center">
                                        <Package className={cn("mr-3 h-5 w-5", productsSection.active ? "text-blue-600 dark:text-blue-400" : "text-blue-600 dark:text-blue-400")} />
                                        Produkte
                                    </div>
                                    {productsSection.expanded ? (
                                        <ChevronDown className="h-4 w-4 text-blue-500" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-blue-500" />
                                    )}
                                </button>
                                {productsSection.expanded && (
                                    <div className="space-y-1 ml-2">
                                        {productsSection.items.map((item) => (
                                            <Button
                                                key={item.href}
                                                variant={item.active ? "secondary" : "ghost"}
                                                className={cn(
                                                    "w-full justify-start text-sm font-medium pl-10 transition-all duration-200",
                                                    item.active
                                                        ? "bg-blue-600 dark:bg-blue-700 shadow text-white hover:bg-blue-700 dark:hover:bg-blue-800"
                                                        : "text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900"
                                                )}
                                                asChild
                                            >
                                                <Link to={item.href}>
                                                    <span className="mr-2">
                                                        {item.label === "Lagerbestand" ? (
                                                            <BarChart3 className="h-4 w-4 inline" />
                                                        ) : (
                                                            <Package className="h-4 w-4 inline" />
                                                        )}
                                                    </span>
                                                    {item.label}
                                                </Link>
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Divider */}
                        {!isAdmin && <div className="my-3 border-t border-blue-200 dark:border-blue-800" />}

                        {/* Sales Routes */}
                        {!isAdmin && salesRoutes.map((route) => renderRouteButton(route))}
                    </div>
                </div>

                <div className="px-3 py-2 mt-auto">
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full justify-start text-base font-medium text-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-900",
                            isActive("/settings") && "bg-blue-600 dark:bg-blue-700 shadow-lg text-white hover:bg-blue-700 dark:hover:bg-blue-800"
                        )}
                        asChild
                    >
                        <Link to={tenantUrl("/settings")}>
                            <Settings className={cn("mr-3 h-5 w-5", isActive("/settings") ? "text-white" : "text-blue-600 dark:text-blue-400")} />
                            Einstellungen
                        </Link>
                    </Button>
                </div>
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
                <Sidebar className="w-full border-none" />
            </SheetContent>
        </Sheet>
    )
}
