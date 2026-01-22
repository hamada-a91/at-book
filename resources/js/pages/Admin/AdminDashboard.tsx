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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import axios from '@/lib/axios';
import { format } from 'date-fns';
import { Users, Building, Bug, Ticket, Lock, Unlock, Trash2, Plus } from 'lucide-react';

export default function AdminDashboard() {
    const [stats, setStats] = useState({ tenants_count: 0, users_count: 0, bugs_count: 0 });
    const [tenants, setTenants] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [bugs, setBugs] = useState<any[]>([]);
    const [serials, setSerials] = useState<any[]>([]);
    const [selectedBug, setSelectedBug] = useState<any | null>(null);
    const [serialDialogOpen, setSerialDialogOpen] = useState(false);
    const [generateParams, setGenerateParams] = useState({ count: 1, prefix: '' });
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsRes, tenantsRes, usersRes, bugsRes, serialsRes] = await Promise.all([
                axios.get('/api/admin/stats'),
                axios.get('/api/admin/tenants'),
                axios.get('/api/admin/users'),
                axios.get('/api/admin/bug-reports'),
                axios.get('/api/admin/serial-numbers'),
            ]);

            setStats(statsRes.data);
            setTenants(Array.isArray(tenantsRes.data) ? tenantsRes.data : []);
            setUsers(Array.isArray(usersRes.data?.data) ? usersRes.data.data : Array.isArray(usersRes.data) ? usersRes.data : []);
            setBugs(Array.isArray(bugsRes.data) ? bugsRes.data : []);
            setSerials(Array.isArray(serialsRes.data) ? serialsRes.data : []);
        } catch (error) {
            console.error('Failed to load admin data', error);
        }
    };

    const updateBugStatus = async (bugId: number, newStatus: string) => {
        try {
            await axios.patch(`/api/admin/bug-reports/${bugId}`, { status: newStatus });
            const bugsRes = await axios.get('/api/admin/bug-reports');
            setBugs(Array.isArray(bugsRes.data) ? bugsRes.data : []);
            const statsRes = await axios.get('/api/admin/stats');
            setStats(statsRes.data);
        } catch (error) {
            console.error('Failed to update bug status', error);
        }
    };

    const handleBlockUser = async (userId: number) => {
        if (!confirm('Are you sure you want to block this user?')) return;
        try {
            await axios.post(`/api/admin/users/${userId}/block`);
            loadData(); // Reload to update status
        } catch (error) {
            console.error('Failed to block user', error);
            alert('Failed to block user');
        }
    };

    const handleUnblockUser = async (userId: number) => {
        if (!confirm('Are you sure you want to unblock this user?')) return;
        try {
            await axios.post(`/api/admin/users/${userId}/unblock`);
            loadData(); // Reload to update status
        } catch (error) {
            console.error('Failed to unblock user', error);
            alert('Failed to unblock user');
        }
    };

    const handleGenerateSerials = async () => {
        setIsGenerating(true);
        try {
            await axios.post('/api/admin/serial-numbers', generateParams);
            setSerialDialogOpen(false);
            setGenerateParams({ count: 1, prefix: '' });
            const serialsRes = await axios.get('/api/admin/serial-numbers');
            setSerials(Array.isArray(serialsRes.data) ? serialsRes.data : []);
        } catch (error) {
            console.error('Failed to generate serials', error);
            alert('Failed to generate serials');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeleteSerial = async (id: number) => {
        if (!confirm('Are you sure you want to delete this serial number?')) return;
        try {
            await axios.delete(`/api/admin/serial-numbers/${id}`);
            const serialsRes = await axios.get('/api/admin/serial-numbers');
            setSerials(Array.isArray(serialsRes.data) ? serialsRes.data : []);
        } catch (error) {
            console.error('Failed to delete serial', error);
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
                    <TabsTrigger value="serials">Serial Numbers</TabsTrigger>
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
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.tenant ? user.tenant.id : <Badge variant="secondary">Global Admin</Badge>}</TableCell>
                                        <TableCell>
                                            {user.blocked_at ? (
                                                <Badge variant="destructive">Blocked</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {user.blocked_at ? (
                                                <Button size="sm" variant="outline" onClick={() => handleUnblockUser(user.id)}>
                                                    <Unlock className="w-4 h-4 mr-1" /> Unblock
                                                </Button>
                                            ) : (
                                                <Button size="sm" variant="destructive" onClick={() => handleBlockUser(user.id)}>
                                                    <Lock className="w-4 h-4 mr-1" /> Block
                                                </Button>
                                            )}
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
                                                className="border rounded px-2 py-1 text-sm bg-background"
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

                <TabsContent value="serials" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">Serial Numbers</h3>
                        <Button onClick={() => setSerialDialogOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Generate New
                        </Button>
                    </div>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Serial Number</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Used By</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {serials.map((serial) => (
                                    <TableRow key={serial.id}>
                                        <TableCell className="font-mono">{serial.serial_number}</TableCell>
                                        <TableCell>
                                            {serial.is_used ? (
                                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">Used</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Available</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {serial.used_by ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{serial.used_by.name}</span>
                                                    <span className="text-xs text-muted-foreground">{serial.used_by.email}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{format(new Date(serial.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDeleteSerial(serial.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {serials.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No serial numbers found. Generate some to get started.
                                        </TableCell>
                                    </TableRow>
                                )}
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

            {/* Generate Serial Dialog */}
            <Dialog open={serialDialogOpen} onOpenChange={setSerialDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Generate Serial Numbers</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="count" className="text-right">
                                Count
                            </Label>
                            <Input
                                id="count"
                                type="number"
                                min={1}
                                max={50}
                                value={generateParams.count}
                                onChange={(e) => setGenerateParams({ ...generateParams, count: parseInt(e.target.value) })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="prefix" className="text-right">
                                Prefix
                            </Label>
                            <Input
                                id="prefix"
                                placeholder="Optional (e.g. SUMMER)"
                                value={generateParams.prefix}
                                onChange={(e) => setGenerateParams({ ...generateParams, prefix: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSerialDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleGenerateSerials} disabled={isGenerating}>
                            {isGenerating ? 'Generating...' : 'Generate'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
