import { Suspense } from 'react';
import { ReportList } from '@/components/reports/ReportList';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { CreateReportButton } from '@/components/reports/CreateReportButton';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function ReportsPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Bug Reports</h1>
                    <p className="text-muted-foreground">
                        Convert natural language bug reports into deterministic repros
                    </p>
                </div>
                <CreateReportButton />
            </div>

            <div className="space-y-6">
                <ReportFilters />
                <Suspense fallback={<LoadingSpinner />}>
                    <ReportList />
                </Suspense>
            </div>
        </div>
    );
}
