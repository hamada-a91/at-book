import { Link, useLocation, useParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    BookOpen,
    Receipt,
    FileText,
    Package
} from "lucide-react"

export function BottomNav() {
    const location = useLocation()
    const { tenant } = useParams()
    const pathname = location.pathname

    const tenantUrl = (path: string) => {
        return tenant ? `/${tenant}${path}` : path
    }

    const isActive = (path: string) => {
        if (path === '/dashboard' || path === '/') {
            return pathname === `/${tenant}` || pathname === `/${tenant}/dashboard` || pathname === `/${tenant}/`
        }
        return pathname.startsWith(`/${tenant}${path}`)
    }

    const navItems = [
        {
            label: "Home",
            icon: LayoutDashboard,
            href: tenantUrl("/dashboard"),
            active: isActive("/dashboard")
        },
        {
            label: "Buchungen",
            icon: BookOpen,
            href: tenantUrl("/bookings"),
            active: isActive("/bookings")
        },
        {
            label: "Belege",
            icon: Receipt,
            href: tenantUrl("/belege"),
            active: isActive("/belege")
        },
        {
            label: "Rechnungen",
            icon: FileText,
            href: tenantUrl("/invoices"),
            active: isActive("/invoices")
        },
        {
            label: "Produkte",
            icon: Package,
            href: tenantUrl("/products"),
            active: isActive("/products")
        }
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 md:hidden pb-safe">
            <div className="flex items-center justify-around h-16">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                            "flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200",
                            item.active
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-300"
                        )}
                    >
                        <item.icon className={cn("h-6 w-6", item.active && "animate-in zoom-in-75 duration-300")} />
                        <span className="text-[10px] font-medium leading-none">{item.label}</span>
                        {item.active && (
                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400" />
                        )}
                    </Link>
                ))}
            </div>
        </nav>
    )
}
