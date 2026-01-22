import { Settings, LogOut, UserCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';

export function UserProfile() {
    const navigate = useNavigate();
    const { tenant } = useParams();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            setLoading(true);
            const { data } = await axios.get('/api/user');

            // data typically contains the user object directly or under a 'user' key
            const userData = data.user || data;

            const user = {
                ...userData,
                avatar: userData.avatar ?? null,
                initials: userData.name ? userData.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'AH',
            };

            setUser(user);
        } catch (error) {
            console.error('Failed to load user', error);
        } finally {
            setLoading(false);
        }
    };


    // Helper for tenant-aware URLs
    const tenantUrl = (path: string) => tenant ? `/${tenant}${path}` : path;


    const handleLogout = async () => {
        try {
            await axios.post('/api/logout');
        } catch (error) {
            console.error('Logout error:', error);
        }
        // Redirect to login page
        window.location.href = '/login';
    };

    if (loading) {
        return (
            <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
        );
    }

    if (!user) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10 border-2 border-slate-200 dark:border-slate-700">
                        <AvatarImage src={user.avatar || undefined} alt={user.name} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                            {user.initials}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none text-slate-900 dark:text-slate-100">
                            {user.name}
                        </p>
                        <p className="text-xs leading-none text-slate-500 dark:text-slate-400">
                            {user.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem
                        onClick={() => navigate(tenantUrl('/profile'))}
                        className="cursor-pointer"
                    >
                        <UserCircle className="mr-2 h-4 w-4" />
                        <span>Profil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => navigate(tenantUrl('/settings'))}
                        className="cursor-pointer"
                    >
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Einstellungen</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Abmelden</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
