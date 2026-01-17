import axios from '../lib/axios';

export interface BugReport {
    id: number;
    title: string;
    description: string;
    error_details?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    created_at: string;
    user?: {
        name: string;
        email: string;
    };
}

export const bugReportService = {
    getReports: async () => {
        const response = await axios.get<BugReport[]>('/api/bug-reports');
        return response.data;
    },

    createReport: async (data: Partial<BugReport>) => {
        const response = await axios.post<BugReport>('/api/bug-reports', data);
        return response.data;
    }
};
