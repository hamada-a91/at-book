import { Sidebar } from "./sidebar"
import { Header } from "./header"

interface MainLayoutProps {
    children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900/50">
            <div className="grid min-h-screen w-full md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr]">
                <div className="hidden border-r bg-slate-50/40 dark:bg-slate-900/40 md:block print:hidden">
                    <Sidebar className="fixed w-[240px] lg:w-[280px]" />
                </div>
                <div className="flex flex-col">
                    <div className="print:hidden">
                        <Header />
                    </div>
                    <main className="flex-1 p-4 md:p-8 pt-6">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    )
}
