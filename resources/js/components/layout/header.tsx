import { ThemeToggle } from "@/components/theme-toggle"
import { MobileSidebar } from "./sidebar"
import { Search, Bell } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center px-4">
                <MobileSidebar />
                <div className="flex flex-1 items-center justify-between space-x-4 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Suchen..."
                                className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[300px]"
                            />
                        </div>
                    </div>
                    <nav className="flex items-center space-x-2">
                        <Button variant="ghost" size="icon" className="relative">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
                        </Button>
                        <ThemeToggle />
                    </nav>
                </div>
            </div>
        </header>
    )
}
