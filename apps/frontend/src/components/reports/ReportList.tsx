import { useState, useEffect } from 'react';
import { Report, Signal } from '@/types/api';
import { apiClient } from '@/lib/api-client';
import { ReportCard } from './ReportCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface ReportListProps {
    projectId?: string;
}

export function ReportList({ projectId }: ReportListProps) {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchReports();
    }, [projectId]);

    const fetchReports = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await apiClient.get<Report[]>('/reports', {
                params: projectId ? { projectId } : undefined,
            });

            setReports(response.data || []);
        } catch (err: any) {
            const errorMessage = err?.response?.data?.detail || 'Failed to fetch reports';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchReports();
        setRefreshing(false);
    };

    const handleViewReport = (report: Report) => {
        // Navigate to report detail page
        window.location.href = `/reports/${report.id}`;
    };

    const handleEditReport = (report: Report) => {
        // Open edit modal or navigate to edit page
        toast.info(`Edit functionality for report: ${report.title}`);
    };

    const handleDeleteReport = async (report: Report) => {
        if (!confirm(`Are you sure you want to delete "${report.title}"?`)) {
            return;
        }

        try {
            await apiClient.delete(`/reports/${report.id}`);
            toast.success('Report deleted successfully');
            await fetchReports(); // Refresh the list
        } catch (err: any) {
            const errorMessage = err?.response?.data?.detail || 'Failed to delete report';
            toast.error(errorMessage);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <LoadingSpinner />
                <span className="ml-2">Loading reports...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Failed to load reports
                </h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={handleRefresh} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                </Button>
            </div>
        );
    }

    if (reports.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No reports found
                </h3>
                <p className="text-gray-600 mb-4">
                    {projectId
                        ? 'No reports have been created for this project yet.'
                        : 'Get started by creating your first bug report.'
                    }
                </p>
                <Button onClick={() => window.location.href = '/reports/new'}>
                    Create First Report
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with refresh button */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">
                        {projectId ? 'Project Reports' : 'All Reports'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {reports.length} report{reports.length !== 1 ? 's' : ''} found
                    </p>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={refreshing}
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Reports Grid */}
            <div className="grid gap-6">
                {reports.map((report) => (
                    <ReportCard
                        key={report.id}
                        report={report}
                        signals={report.signals || []}
                        onView={handleViewReport}
                        onEdit={handleEditReport}
                        onDelete={handleDeleteReport}
                    />
                ))}
            </div>

            {/* Load More (if pagination is implemented) */}
            {reports.length >= 20 && (
                <div className="text-center">
                    <Button variant="outline">
                        Load More Reports
                    </Button>
                </div>
            )}
        </div>
    );
}
