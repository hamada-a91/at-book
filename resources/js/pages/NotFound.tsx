import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileQuestion, Home } from 'lucide-react';
import { useParams } from 'react-router-dom';

export default function NotFound() {
    const navigate = useNavigate();
    const { tenant } = useParams();

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="relative">
                <div className="w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center animate-pulse">
                    <FileQuestion className="w-16 h-16 text-slate-400 dark:text-slate-500" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg border-2 border-white dark:border-slate-900">
                    404
                </div>
            </div>

            <div className="space-y-2 max-w-md px-4">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Seite nicht gefunden
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Die gesuchte Seite existiert nicht oder wurde verschoben.
                    Bitte überprüfen Sie die URL oder kehren Sie zum Dashboard zurück.
                </p>
            </div>

            <Button
                onClick={() => navigate(tenant ? `/${tenant}/dashboard` : '/')}
                className="gap-2 shadow-lg hover:shadow-xl transition-all"
                size="lg"
            >
                <Home className="w-5 h-5" />
                Zum Dashboard
            </Button>
        </div>
    );
}
