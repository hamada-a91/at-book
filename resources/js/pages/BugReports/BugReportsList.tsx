import { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BugReportDialog } from './BugReportDialog';
import { bugReportService, BugReport } from '@/services/bugReportService';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function BugReportsList() {
    const [reports, setReports] = useState<BugReport[]>([]);
    const [loading, setLoading] = useState(true);

    const loadReports = async () => {
        setLoading(true);
        try {
            const data = await bugReportService.getReports();
            setReports(data);
        } catch (error) {
            console.error('Failed to load reports', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open': return <Badge variant="destructive">Open</Badge>;
            case 'in_progress': return <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">In Progress</Badge>;
            case 'resolved': return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Resolved</Badge>;
            case 'closed': return <Badge variant="secondary">Closed</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'text-red-600 font-bold';
            case 'high': return 'text-orange-600 font-semibold';
            case 'medium': return 'text-blue-600';
            default: return 'text-gray-600';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Bug Reports</h2>
                    <p className="text-muted-foreground">
                        Track and manage reported issues.
                    </p>
                </div>
                <BugReportDialog
                    trigger={
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Report Bug
                        </Button>
                    }
                    onSuccess={loadReports}
                />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">Status</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead className="w-[100px]">Priority</TableHead>
                            <TableHead>Reported By</TableHead>
                            <TableHead>Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reports.map((report) => (
                            <TableRow key={report.id}>
                                <TableCell>{getStatusBadge(report.status)}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{report.title}</div>
                                    <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                                        {report.description}
                                    </div>
                                </TableCell>
                                <TableCell className={getPriorityColor(report.priority)}>
                                    {report.priority.toUpperCase()}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{report.user?.name}</span>
                                        <span className="text-xs text-muted-foreground">{report.user?.email}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {format(new Date(report.created_at), 'MMM d, yyyy')}
                                </TableCell>
                            </TableRow>
                        ))}
                        {reports.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No bug reports found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
