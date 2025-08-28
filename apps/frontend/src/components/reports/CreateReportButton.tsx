import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';

export function CreateReportButton() {
    const handleCreateReport = () => {
        // Navigate to create report page or open modal
        window.location.href = '/reports/new';
    };

    return (
        <Button onClick={handleCreateReport}>
            <Plus className="h-4 w-4 mr-2" />
            New Report
        </Button>
    );
}
