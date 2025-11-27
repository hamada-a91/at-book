import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, BookOpen, Users, LayoutDashboard, ChevronRight, Settings } from 'lucide-react';

interface NavigationProps {
    children: React.ReactNode;
}

export function Navigation({ children }: NavigationProps) {
    const location = useLocation();

    const navigation = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Konten', href: '/accounts', icon: FileText },
        { name: 'Journal', href: '/bookings', icon: BookOpen },
        { name: 'Kontakte', href: '/contacts', icon: Users },
        { name: 'Einstellungen', href: '/settings', icon: Settings },
    ];

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    // Breadcrumb logic
    const getBreadcrumbs = () => {
        const paths = location.pathname.split('/').filter(Boolean);
        const breadcrumbs = [{ name: 'Dashboard', path: '/' }];

        const pathMap: Record<string, string> = {
            accounts: 'Konten',
            bookings: 'Journal',
            contacts: 'Kontakte',
            settings: 'Einstellungen',
            create: 'Erstellen',
        };

        let currentPath = '';
        paths.forEach((path) => {
            currentPath += `/${path}`;
            breadcrumbs.push({
                name: pathMap[path] || path,
                path: currentPath,
            });
        });

        return breadcrumbs;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
            {/* Top Navigation Bar */}
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo & Brand */}
                        <Link to="/" className="flex items-center space-x-3 group">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                                <BookOpen className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">AT-Book</h1>
                                <p className="text-xs text-slate-500">Buchhaltungssystem</p>
                            </div>
                        </Link>

                        {/* Main Navigation */}
                        <div className="hidden md:flex space-x-1">
                            {navigation.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.href}
                                        className={`
                      flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${active
                                                ? 'bg-blue-50 text-blue-700 shadow-sm'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                            }
                    `}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span>{item.name}</span>
                                    </Link>
                                );
                            })}
                        </div>

                        {/* User Profile Placeholder */}
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                A
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Breadcrumbs */}
            {location.pathname !== '/' && (
                <div className="bg-white border-b border-slate-100">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                        <nav className="flex items-center space-x-2 text-sm">
                            {getBreadcrumbs().map((crumb, index) => (
                                <React.Fragment key={crumb.path}>
                                    {index > 0 && <ChevronRight className="w-4 h-4 text-slate-400" />}
                                    <Link
                                        to={crumb.path}
                                        className={`
                      ${index === getBreadcrumbs().length - 1
                                                ? 'text-slate-900 font-medium'
                                                : 'text-slate-500 hover:text-slate-700'
                                            }
                    `}
                                    >
                                        {crumb.name}
                                    </Link>
                                </React.Fragment>
                            ))}
                        </nav>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200 bg-white mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <p className="text-center text-sm text-slate-500">
                        © 2025 AT-Book - GoBD-konformes Buchhaltungssystem
                    </p>
                </div>
            </footer>
        </div>
    );
}
