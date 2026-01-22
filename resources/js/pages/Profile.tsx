import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '@/lib/axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Mail, Calendar, Shield, Settings, Database, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function Profile() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { tenant } = useParams();

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            const { data } = await axios.get('/api/user');
            setUser(data.user);
        } catch (error) {
            console.error('Failed to load user', error);
        } finally {
            setLoading(false);
        }
    };

    const tenantUrl = (path: string) => tenant ? `/${tenant}${path}` : path;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    if (!user) return <div>User not found</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">User Profile</h1>
                <p className="text-muted-foreground">Manage your personal information and settings.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Main Profile Info */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                                <User className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <CardTitle>{user.name}</CardTitle>
                                <CardDescription>{user.email}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-4">
                            <div className="flex items-center justify-between border-b pb-4">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <Mail className="h-4 w-4" />
                                    Email
                                </div>
                                <div className="text-sm">{user.email || 'Nicht hinterlegt'}</div>
                            </div>
                            <div className="flex items-center justify-between border-b pb-4">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <Shield className="h-4 w-4" />
                                    Role
                                </div>
                                <div>
                                    {user.roles?.map((role: any) => (
                                        <Badge key={role.id} variant="secondary" className="ml-1">
                                            {role.name}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    Joined
                                </div>
                                <div className="text-sm">
                                    {user.created_at ? format(new Date(user.created_at), 'PPP') : 'N/A'}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => navigate(tenantUrl('/settings'))}
                            >
                                <Settings className="mr-2 h-4 w-4" />
                                General Settings
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => navigate(tenantUrl('/settings?tab=account-plan'))}
                            >
                                <CreditCard className="mr-2 h-4 w-4" />
                                Manage Account Plan
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => navigate(tenantUrl('/settings?tab=backup'))}
                            >
                                <Database className="mr-2 h-4 w-4" />
                                Backup & Restore
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
