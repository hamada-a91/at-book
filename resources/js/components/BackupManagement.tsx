import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import {
    Download,
    Upload,
    RefreshCw,
    Trash2,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Archive,
    FileArchive,
    Shield,
    Loader2,
    PlayCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BackupJob {
    id: string;
    type: 'export' | 'import';
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress_percent: number;
    current_step: string | null;
    file_size: number | null;
    stats: Record<string, number> | null;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    can_download: boolean;
}

interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    info: {
        backup_version?: string;
        app_version?: string;
        created_at?: string;
        tenant_name?: string;
        total_entities?: number;
        total_files?: number;
    };
}

export function BackupManagement() {
    const queryClient = useQueryClient();
    const [pollingInterval, setPollingInterval] = useState<number | false>(false);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [confirmRestoreDialogOpen, setConfirmRestoreDialogOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadedJobId, setUploadedJobId] = useState<string | null>(null);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);

    // Fetch backup jobs
    const { data: jobsData, isLoading } = useQuery<{ jobs: BackupJob[] }>({
        queryKey: ['backup-jobs'],
        queryFn: async () => {
            const { data } = await axios.get('/api/backup/jobs');
            return data;
        },
        refetchInterval: pollingInterval,
    });

    const jobs = jobsData?.jobs ?? [];

    // Check if any job is running and enable polling
    useEffect(() => {
        const hasRunningJob = jobs.some((j) => j.status === 'pending' || j.status === 'processing');
        setPollingInterval(hasRunningJob ? 2000 : false);
    }, [jobs]);

    // Start export mutation
    const startExportMutation = useMutation({
        mutationFn: async () => {
            const { data } = await axios.post('/api/backup/export', {
                include_files: true,
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backup-jobs'] });
        },
    });

    // Delete backup mutation
    const deleteBackupMutation = useMutation({
        mutationFn: async (jobId: string) => {
            await axios.delete(`/api/backup/jobs/${jobId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backup-jobs'] });
        },
    });

    // Upload backup mutation
    const uploadBackupMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await axios.post('/api/backup/import/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return data;
        },
        onSuccess: (data) => {
            setUploadedJobId(data.job.id);
            queryClient.invalidateQueries({ queryKey: ['backup-jobs'] });
        },
    });

    // Validate backup mutation
    const validateBackupMutation = useMutation({
        mutationFn: async (jobId: string) => {
            const { data } = await axios.post(`/api/backup/import/${jobId}/validate`);
            return data as ValidationResult;
        },
        onSuccess: (data) => {
            setValidationResult(data);
            if (data.valid) {
                setConfirmRestoreDialogOpen(true);
            }
        },
    });

    // Start import mutation
    const startImportMutation = useMutation({
        mutationFn: async ({ jobId, password }: { jobId: string; password: string }) => {
            const { data } = await axios.post(`/api/backup/import/${jobId}/start`, {
                confirm_password: password,
                import_mode: 'replace',
            });
            return data;
        },
        onSuccess: () => {
            setConfirmRestoreDialogOpen(false);
            setUploadDialogOpen(false);
            setConfirmPassword('');
            setPasswordError(null);
            setUploadedJobId(null);
            setValidationResult(null);
            setSelectedFile(null);
            queryClient.invalidateQueries({ queryKey: ['backup-jobs'] });
        },
        onError: (error: any) => {
            if (error.response?.status === 403) {
                setPasswordError('Passwort ist nicht korrekt');
            } else {
                setPasswordError(error.response?.data?.message || 'Ein Fehler ist aufgetreten');
            }
        },
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setValidationResult(null);
            setUploadedJobId(null);
        }
    };

    const handleUpload = async () => {
        if (selectedFile) {
            await uploadBackupMutation.mutateAsync(selectedFile);
        }
    };

    const handleValidate = async () => {
        if (uploadedJobId) {
            await validateBackupMutation.mutateAsync(uploadedJobId);
        }
    };

    const handleStartImport = async () => {
        if (uploadedJobId && confirmPassword) {
            await startImportMutation.mutateAsync({ jobId: uploadedJobId, password: confirmPassword });
        }
    };

    const handleDownload = async (jobId: string) => {
        try {
            const { data } = await axios.get(`/api/backup/jobs/${jobId}/download-url`);
            if (data.download_url) {
                window.open(data.download_url, '_blank');
            }
        } catch (error) {
            console.error('Download error:', error);
        }
    };

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return '-';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status: BackupJob['status']) => {
        switch (status) {
            case 'pending':
                return (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        <Clock className="w-3 h-3 mr-1" />
                        Wartend
                    </Badge>
                );
            case 'processing':
                return (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        In Bearbeitung
                    </Badge>
                );
            case 'completed':
                return (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Abgeschlossen
                    </Badge>
                );
            case 'failed':
                return (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Fehlgeschlagen
                    </Badge>
                );
            case 'cancelled':
                return (
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                        <XCircle className="w-3 h-3 mr-1" />
                        Abgebrochen
                    </Badge>
                );
        }
    };

    const getTypeBadge = (type: BackupJob['type']) => {
        return type === 'export' ? (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                <Download className="w-3 h-3 mr-1" />
                Export
            </Badge>
        ) : (
            <Badge variant="secondary" className="bg-cyan-100 text-cyan-700">
                <Upload className="w-3 h-3 mr-1" />
                Import
            </Badge>
        );
    };

    const hasRunningJob = jobs.some((j) => j.status === 'pending' || j.status === 'processing');

    return (
        <Card className="shadow-lg border-slate-200 dark:border-slate-800 hover:shadow-xl transition-all duration-300">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/20 rounded-lg flex items-center justify-center">
                            <Archive className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Datensicherung</CardTitle>
                            <CardDescription>Erstellen und verwalten Sie Backups Ihrer Daten</CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setUploadDialogOpen(true)}
                            disabled={hasRunningJob}
                            className="hover:bg-cyan-50 dark:hover:bg-cyan-950 hover:border-cyan-600 hover:text-cyan-600"
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            Wiederherstellen
                        </Button>
                        <Button
                            onClick={() => startExportMutation.mutate()}
                            disabled={hasRunningJob || startExportMutation.isPending}
                            className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white shadow-lg shadow-teal-600/30"
                        >
                            {startExportMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <FileArchive className="w-4 h-4 mr-2" />
                            )}
                            Backup erstellen
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Info Alert */}
                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                        Backups enthalten alle Ihre Firmendaten, Kontakte, Rechnungen und Belege als ZIP-Archiv.
                        Dateien (z.B. Belegfotos) werden ebenfalls gesichert.
                    </AlertDescription>
                </Alert>

                {/* Jobs List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <FileArchive className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                        <p>Noch keine Backups vorhanden</p>
                        <p className="text-sm mt-1">Erstellen Sie Ihr erstes Backup mit dem Button oben</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {jobs.slice(0, 10).map((job) => (
                            <div
                                key={job.id}
                                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        {getTypeBadge(job.type)}
                                        {getStatusBadge(job.status)}
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                        <span>Erstellt: {formatDate(job.created_at)}</span>
                                        {job.file_size && (
                                            <span className="ml-3">• Größe: {formatFileSize(job.file_size)}</span>
                                        )}
                                    </div>
                                    {job.status === 'processing' && (
                                        <div className="mt-2">
                                            <Progress value={job.progress_percent} className="h-2" />
                                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                                <span>{job.current_step || 'Verarbeite...'}</span>
                                                <span>{job.progress_percent}%</span>
                                            </div>
                                        </div>
                                    )}
                                    {job.status === 'failed' && job.error_message && (
                                        <Alert variant="destructive" className="mt-2 py-2">
                                            <AlertCircle className="h-3 w-3" />
                                            <AlertDescription className="text-xs">{job.error_message}</AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    {job.can_download && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDownload(job.id)}
                                            className="hover:bg-green-50 hover:border-green-600 hover:text-green-600"
                                        >
                                            <Download className="w-4 h-4" />
                                        </Button>
                                    )}
                                    {job.status !== 'pending' && job.status !== 'processing' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => deleteBackupMutation.mutate(job.id)}
                                            className="hover:bg-red-50 hover:border-red-600 hover:text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Refresh Button */}
                <div className="flex justify-center pt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['backup-jobs'] })}
                        className="text-slate-500"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Aktualisieren
                    </Button>
                </div>
            </CardContent>

            {/* Upload/Import Dialog */}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Upload className="w-5 h-5 text-cyan-600" />
                            Backup wiederherstellen
                        </DialogTitle>
                        <DialogDescription>
                            Laden Sie eine Backup-Datei hoch, um Ihre Daten wiederherzustellen.
                            <strong className="text-red-600 block mt-2">
                                ⚠️ Achtung: Alle aktuellen Daten werden überschrieben!
                            </strong>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* File Input */}
                        <div className="space-y-2">
                            <Label htmlFor="backup-file">Backup-Datei (ZIP)</Label>
                            <Input
                                id="backup-file"
                                type="file"
                                accept=".zip"
                                onChange={handleFileSelect}
                                disabled={uploadBackupMutation.isPending}
                            />
                        </div>

                        {/* Upload Button */}
                        {selectedFile && !uploadedJobId && (
                            <Button
                                onClick={handleUpload}
                                disabled={uploadBackupMutation.isPending}
                                className="w-full"
                            >
                                {uploadBackupMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4 mr-2" />
                                )}
                                Datei hochladen
                            </Button>
                        )}

                        {/* Validation Step */}
                        {uploadedJobId && !validationResult && (
                            <Button
                                onClick={handleValidate}
                                disabled={validateBackupMutation.isPending}
                                className="w-full bg-yellow-600 hover:bg-yellow-700"
                            >
                                {validateBackupMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Shield className="w-4 h-4 mr-2" />
                                )}
                                Backup validieren
                            </Button>
                        )}

                        {/* Validation Results */}
                        {validationResult && !validationResult.valid && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Validierung fehlgeschlagen:</strong>
                                    <ul className="list-disc list-inside mt-1">
                                        {validationResult.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                            Abbrechen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Restore Dialog */}
            <Dialog open={confirmRestoreDialogOpen} onOpenChange={setConfirmRestoreDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertCircle className="w-5 h-5" />
                            Wiederherstellung bestätigen
                        </DialogTitle>
                        <DialogDescription>
                            {validationResult?.info && (
                                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm">
                                    <div><strong>Backup-Version:</strong> {validationResult.info.backup_version}</div>
                                    <div><strong>Erstellt am:</strong> {formatDate(validationResult.info.created_at ?? null)}</div>
                                    <div><strong>Datensätze:</strong> {validationResult.info.total_entities}</div>
                                    <div><strong>Dateien:</strong> {validationResult.info.total_files}</div>
                                </div>
                            )}
                            {validationResult?.warnings && validationResult.warnings.length > 0 && (
                                <Alert className="mt-3 bg-yellow-50 border-yellow-200">
                                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                                    <AlertDescription className="text-yellow-800">
                                        <strong>Warnungen:</strong>
                                        <ul className="list-disc list-inside mt-1">
                                            {validationResult.warnings.map((w, i) => (
                                                <li key={i}>{w}</li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">
                                Geben Sie Ihr Passwort ein, um fortzufahren:
                            </Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Ihr Passwort"
                            />
                            {passwordError && (
                                <p className="text-sm text-red-600">{passwordError}</p>
                            )}
                        </div>

                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                Ein automatisches Pre-Restore-Backup wird erstellt, bevor die Daten überschrieben werden.
                            </AlertDescription>
                        </Alert>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setConfirmRestoreDialogOpen(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            onClick={handleStartImport}
                            disabled={!confirmPassword || startImportMutation.isPending}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {startImportMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <PlayCircle className="w-4 h-4 mr-2" />
                            )}
                            Wiederherstellen starten
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
