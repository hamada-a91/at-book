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
    Receipt,
    Landmark,
} from "lucide-react"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const location = useLocation()
    const pathname = location.pathname

    const { data: settings } = useQuery({
        queryKey: ['settings'],
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
            label: "Bank Konto",
            icon: Landmark,
            href: "/bank-accounts",
            active: pathname.startsWith("/bank-accounts"),
        },
        {
            label: "Journal & Berichte",
            icon: FileText,
            href: "/reports",
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
        {
            label: "Belege",
            icon: Receipt,
            href: "/belege",
            active: pathname.startsWith("/belege"),
        },
    ]

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
                    <div className="space-y-1">
                        {routes.map((route) => (
                            <Button
                                key={route.href}
                                variant={route.active ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start text-base font-medium transition-all duration-200",
                                    route.active
                                        ? "bg-blue-600 dark:bg-blue-700 shadow-lg text-white hover:bg-blue-700 dark:hover:bg-blue-800 scale-105"
                                        : "text-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-900 hover:text-blue-950 dark:hover:text-white"
                                )}
                                asChild
                            >
                                <Link to={route.href}>
                                    <route.icon className={cn("mr-3 h-5 w-5", route.active ? "text-white" : "text-blue-600 dark:text-blue-400")} />
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
                            "w-full justify-start text-base font-medium text-blue-900 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-900",
                            pathname.startsWith("/settings") && "bg-blue-600 dark:bg-blue-700 shadow-lg text-white hover:bg-blue-700 dark:hover:bg-blue-800"
                        )}
                        asChild
                    >
                        <Link to="/settings">
                            <Settings className={cn("mr-3 h-5 w-5", pathname.startsWith("/settings") ? "text-white" : "text-blue-600 dark:text-blue-400")} />
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
            <SheetContent side="left" className="p-0 w-72 bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-950 dark:to-slate-950">
                <Sidebar className="w-full border-none" />
            </SheetContent>
        </Sheet>
    )
}
