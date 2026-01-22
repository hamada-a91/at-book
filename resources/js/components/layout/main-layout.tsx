import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { BottomNav } from "./bottom-nav"

interface MainLayoutProps {
    children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900/50">
            <div className="grid min-h-screen w-full md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr]">
                <div className="hidden bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-950 dark:to-slate-950 md:block print:hidden">
                    <Sidebar className="fixed w-[240px] lg:w-[280px]" />
                </div>
                <div className="flex flex-col">
                    <div className="print:hidden">
                        <Header />
                    </div>
                    <main className="flex-1 p-4 md:p-8 pt-6 pb-20 md:pb-8">
                        {children}
                    </main>
                </div>
            </div>
            <BottomNav />
        </div>
    )
}
