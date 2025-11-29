import { useState } from 'react';
import { Bell, FileText, Users, Receipt, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Notification {
    id: number;
    type: 'invoice' | 'contact' | 'booking' | 'alert';
    title: string;
    description: string;
    time: string;
    read: boolean;
}

// Mock notifications - replace with actual data from API
const mockNotifications: Notification[] = [
    {
        id: 1,
        type: 'invoice',
        title: 'Neue Rechnung erstellt',
        description: 'Rechnung #1234 wurde erfolgreich erstellt',
        time: 'vor 5 Minuten',
        read: false,
    },
    {
        id: 2,
        type: 'contact',
        title: 'Neuer Kontakt hinzugefügt',
        description: 'Max Mustermann wurde als Kontakt hinzugefügt',
        time: 'vor 1 Stunde',
        read: false,
    },
    {
        id: 3,
        type: 'booking',
        title: 'Buchung gebucht',
        description: 'Buchung #567 wurde erfolgreich gebucht',
        time: 'vor 2 Stunden',
        read: true,
    },
    {
        id: 4,
        type: 'alert',
        title: 'Systembenachrichtigung',
        description: 'Backup wurde erfolgreich durchgeführt',
        time: 'vor 1 Tag',
        read: true,
    },
];

const notificationIcons = {
    invoice: FileText,
    contact: Users,
    booking: Receipt,
    alert: AlertCircle,
};

const notificationColors = {
    invoice: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
    contact: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30',
    booking: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
    alert: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
};

export function Notifications() {
    const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
    const unreadCount = notifications.filter((n) => !n.read).length;

    const markAllAsRead = () => {
        setNotifications(notifications.map((n) => ({ ...n, read: true })));
    };

    const markAsRead = (id: number) => {
        setNotifications(
            notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                    <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white text-xs font-bold shadow-lg animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        Benachrichtigungen
                    </h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={markAllAsRead}
                            className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                            Alle als gelesen markieren
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[400px]">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                            <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Keine Benachrichtigungen
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {notifications.map((notification) => {
                                const Icon = notificationIcons[notification.type];
                                return (
                                    <div
                                        key={notification.id}
                                        className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                                            }`}
                                        onClick={() => markAsRead(notification.id)}
                                    >
                                        <div className="flex gap-3">
                                            <div
                                                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${notificationColors[notification.type]
                                                    }`}
                                            >
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                        {notification.title}
                                                    </p>
                                                    {!notification.read && (
                                                        <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 flex-shrink-0 mt-1" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    {notification.description}
                                                </p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                                    {notification.time}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
