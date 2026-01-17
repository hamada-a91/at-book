import { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import axios from '@/lib/axios';
import { format } from 'date-fns';
import { Users, Building, Bug } from 'lucide-react';

export default function AdminDashboard() {
    const [stats, setStats] = useState({ tenants_count: 0, users_count: 0, bugs_count: 0 });
    const [tenants, setTenants] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [bugs, setBugs] = useState<any[]>([]);
    const [selectedBug, setSelectedBug] = useState<any | null>(null);
    // removed unused loading state

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsRes, tenantsRes, usersRes, bugsRes] = await Promise.all([
                axios.get('/api/admin/stats'),
                axios.get('/api/admin/tenants'),
                axios.get('/api/admin/users'),
                axios.get('/api/admin/bug-reports'),
            ]);

            setStats(statsRes.data);
            setTenants(Array.isArray(tenantsRes.data) ? tenantsRes.data : []);
            setUsers(Array.isArray(usersRes.data?.data) ? usersRes.data.data : Array.isArray(usersRes.data) ? usersRes.data : []);
            setBugs(Array.isArray(bugsRes.data) ? bugsRes.data : []);
        } catch (error) {
            console.error('Failed to load admin data', error);
        }
    };

    const updateBugStatus = async (bugId: number, newStatus: string) => {
        try {
            await axios.patch(`/api/admin/bug-reports/${bugId}`, { status: newStatus });
            // Reload bug reports to reflect the change
            const bugsRes = await axios.get('/api/admin/bug-reports');
            setBugs(Array.isArray(bugsRes.data) ? bugsRes.data : []);

            // Also update stats if status changed to/from open
            const statsRes = await axios.get('/api/admin/stats');
            setStats(statsRes.data);
        } catch (error) {
            console.error('Failed to update bug status', error);
        }
    };


    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">System Administration</h2>
                <p className="text-muted-foreground">
                    Global overview of the system.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.tenants_count}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.users_count}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Open Bugs</CardTitle>
                        <Bug className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.bugs_count}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="tenants" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="tenants">Tenants</TabsTrigger>
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="bugs">Bug Reports</TabsTrigger>
                </TabsList>

                <TabsContent value="tenants" className="space-y-4">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tenant ID</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead>Users</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tenants.map((tenant) => (
                                    <TableRow key={tenant.id}>
                                        <TableCell className="font-medium">{tenant.id}</TableCell>
                                        <TableCell>{format(new Date(tenant.created_at), 'MMM d, yyyy')}</TableCell>
                                        <TableCell>{tenant.users_count}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                <TabsContent value="users" className="space-y-4">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Tenant</TableHead>
                                    <TableHead>Role</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.tenant ? user.tenant.id : <Badge variant="secondary">Global Admin</Badge>}</TableCell>
                                        <TableCell>
                                            {user.roles.map((r: any) => (
                                                <Badge key={r.id} variant="outline" className="mr-1">{r.name}</Badge>
                                            ))}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                <TabsContent value="bugs" className="space-y-4">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Problem</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead>Tenant</TableHead>
                                    <TableHead>User</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bugs.map((bug) => (
                                    <TableRow
                                        key={bug.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => setSelectedBug(bug)}
                                    >
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <select
                                                value={bug.status}
                                                onChange={(e) => updateBugStatus(bug.id, e.target.value)}
                                                className="border rounded px-2 py-1 text-sm"
                                            >
                                                <option value="open">Open</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="resolved">Resolved</option>
                                                <option value="closed">Closed</option>
                                            </select>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{bug.title}</div>
                                            <div className="text-xs text-muted-foreground">{bug.description.substring(0, 50)}...</div>
                                        </TableCell>
                                        <TableCell>{bug.priority}</TableCell>
                                        <TableCell>{bug.tenant?.id || 'N/A'}</TableCell>
                                        <TableCell>{bug.user?.name}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Bug Detail Dialog */}
            <Dialog open={!!selectedBug} onOpenChange={() => setSelectedBug(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedBug?.title}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-2">Description</h4>
                            <p className="text-sm text-muted-foreground">{selectedBug?.description}</p>
                        </div>
                        {selectedBug?.error_details && (
                            <div>
                                <h4 className="font-semibold mb-2">Error Details</h4>
                                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{selectedBug.error_details}</pre>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="font-semibold">Status:</span> {selectedBug?.status}
                            </div>
                            <div>
                                <span className="font-semibold">Priority:</span> {selectedBug?.priority}
                            </div>
                            <div>
                                <span className="font-semibold">Reporter:</span> {selectedBug?.user?.name}
                            </div>
                            <div>
                                <span className="font-semibold">Tenant:</span> {selectedBug?.tenant?.id || 'N/A'}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
