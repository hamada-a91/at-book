import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
    LayoutDashboard,
    Users,
    FileText,
    Settings,
    Menu,
    CreditCard,
    BookOpen,
    Building2,
    PlusCircle
} from "lucide-react"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const location = useLocation()
    const pathname = location.pathname

    const { data: settings } = useQuery({
        queryKey: ['company-settings'],
        queryFn: async () => {
            const res = await fetch('/api/settings');
            return res.json();
        },
    });

    const routes = [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            href: "/",
            active: pathname === "/",
        },
        {
            label: "Buchungen",
            icon: BookOpen,
            href: "/bookings",
            active: pathname.startsWith("/bookings"),
        },
        {
            label: "Konten & Bank",
            icon: CreditCard,
            href: "/accounts",
            active: pathname.startsWith("/accounts"),
        },
        {
            label: "Journal & Berichte",
            icon: FileText,
            href: "/reports", // Assuming reports or journal
            active: pathname.startsWith("/reports"),
        },
        {
            label: "Kontakte",
            icon: Users,
            href: "/contacts",
            active: pathname.startsWith("/contacts"),
        },
        {
            label: "Rechnungen",
            icon: FileText,
            href: "/invoices",
            active: pathname.startsWith("/invoices"),
        },
    ]

    return (
        <div className={cn("pb-12 bg-slate-50/50 dark:bg-slate-900/50 border-r h-full", className)}>
            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <div className="flex items-center px-4 mb-8">
                        {settings?.logo_url ? (
                            <img src={settings.logo_url} alt="Logo" className="h-8 w-auto mr-2" />
                        ) : (
                            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center mr-2">
                                <Building2 className="h-5 w-5 text-primary-foreground" />
                            </div>
                        )}
                        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            {settings?.company_name || 'AT-Book'}
                        </h2>
                    </div>
                    <div className="space-y-1">
                        {routes.map((route) => (
                            <Button
                                key={route.href}
                                variant={route.active ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start text-base font-medium transition-all duration-200",
                                    route.active
                                        ? "bg-white dark:bg-slate-800 shadow-sm text-primary translate-x-1"
                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                                )}
                                asChild
                            >
                                <Link to={route.href}>
                                    <route.icon className={cn("mr-3 h-5 w-5", route.active ? "text-primary" : "text-slate-500")} />
                                    {route.label}
                                </Link>
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="px-3 py-2 mt-auto">
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full justify-start text-base font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
                            pathname.startsWith("/settings") && "bg-white dark:bg-slate-800 shadow-sm text-primary"
                        )}
                        asChild
                    >
                        <Link to="/settings">
                            <Settings className="mr-3 h-5 w-5" />
                            Einstellungen
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
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
            <SheetContent side="left" className="p-0 w-72">
                <Sidebar className="w-full" />
            </SheetContent>
        </Sheet>
    )
}
