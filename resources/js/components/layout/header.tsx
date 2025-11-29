import { ThemeToggle } from "@/components/theme-toggle"
import { MobileSidebar } from "./sidebar"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CommandPalette } from "./command-palette"
import { UserProfile } from "./user-profile"
import { Notifications } from "./notifications"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useLocation } from "react-router-dom"

export function Header() {
    const location = useLocation()

    // Generate breadcrumbs from current path
    const getBreadcrumbs = () => {
        const path = location.pathname
        const segments = path.split('/').filter(Boolean)

        const breadcrumbMap: Record<string, string> = {
            '': 'Dashboard',
            'invoices': 'Rechnungen',
            'contacts': 'Kontakte',
            'accounts': 'Konten',
            'journal': 'Journal',
            'bookings': 'Buchungen',
            'settings': 'Einstellungen',
            'create': 'Erstellen',
            'edit': 'Bearbeiten',
            'preview': 'Vorschau',
        }

        if (segments.length === 0) {
            return [{ label: 'Dashboard', path: '/', isLast: true }]
        }

        return segments.map((segment, index) => ({
            label: breadcrumbMap[segment] || segment,
            path: '/' + segments.slice(0, index + 1).join('/'),
            isLast: index === segments.length - 1,
        }))
    }

    const breadcrumbs = getBreadcrumbs()

    return (
        <>
            <CommandPalette />
            <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-slate-950/70 shadow-lg">
                <div className="container flex h-16 items-center px-4 gap-4">
                    <MobileSidebar />

                    {/* Breadcrumbs - Left side on desktop */}
                    <div className="hidden lg:flex">
                        <Breadcrumb>
                            <BreadcrumbList>
                                {breadcrumbs.map((crumb, index) => (
                                    <div key={crumb.path} className="flex items-center gap-2">
                                        {index > 0 && <BreadcrumbSeparator />}
                                        <BreadcrumbItem>
                                            {crumb.isLast ? (
                                                <BreadcrumbPage className="font-semibold text-blue-600 dark:text-blue-400">
                                                    {crumb.label}
                                                </BreadcrumbPage>
                                            ) : (
                                                <BreadcrumbLink
                                                    href={crumb.path}
                                                    className="transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                                                >
                                                    {crumb.label}
                                                </BreadcrumbLink>
                                            )}
                                        </BreadcrumbItem>
                                    </div>
                                ))}
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>

                    {/* Search - Center */}
                    <div className="flex-1 flex justify-center max-w-2xl mx-auto">
                        <div className="relative group w-full max-w-md">
                            <Button
                                variant="outline"
                                className="relative h-10 w-full px-3 justify-start gap-2 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                            >
                                <Search className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                <span className="text-sm text-slate-500 dark:text-slate-400">
                                    Suchen...
                                </span>
                                <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-600 dark:text-slate-400 shadow-sm">
                                    <span className="text-xs">Strg</span>K
                                </kbd>
                            </Button>
                        </div>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-2">
                        {/* Notifications */}
                        <Notifications />

                        {/* Theme Toggle */}
                        <ThemeToggle />

                        {/* User Profile */}
                        <UserProfile />
                    </div>
                </div>
            </header>
        </>
    )
}
