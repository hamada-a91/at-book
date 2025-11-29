import { User, Settings, LogOut, UserCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useNavigate } from 'react-router-dom';

export function UserProfile() {
    const navigate = useNavigate();

    // Mock user data - replace with actual user data from context/API
    const user = {
        name: 'Ahmed',
        email: 'ahmed@example.com',
        avatar: null, // Set to image URL if available
        initials: 'AH',
    };

    const handleLogout = () => {
        // Implement logout logic here
        window.location.href = '/logout';
    };

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
                        onClick={() => navigate('/profile')}
                        className="cursor-pointer"
                    >
                        <UserCircle className="mr-2 h-4 w-4" />
                        <span>Profil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => navigate('/settings')}
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
