import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/Button';
import {
    CheckCircle,
    XCircle,
    Clock,
    Play,
    Download,
    Eye,
    ChevronDown,
    ChevronRight
} from 'lucide-react';

interface Run {
    id: string;
    iteration: number;
    passed: boolean;
    duration_ms: number;
    logs?: string;
    video_url?: string;
    trace_url?: string;
    created_at: string;
}

interface RunTimelineProps {
    runs: Run[];
    onRunSelect?: (run: Run) => void;
    selectedRun?: Run | null;
    onDownloadArtifacts?: (run: Run) => void;
}

export function RunTimeline({
    runs,
    onRunSelect,
    selectedRun,
    onDownloadArtifacts
}: RunTimelineProps) {
    if (runs.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <Clock className="h-8 w-8 mx-auto mb-2" />
                <p>No test runs available</p>
            </div>
        );
    }

    // Sort runs by iteration (most recent first)
    const sortedRuns = [...runs].sort((a, b) => b.iteration - a.iteration);

    const getStatusIcon = (passed: boolean) => {
        return passed ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
            <XCircle className="h-5 w-5 text-red-600" />
        );
    };

    const getStatusColor = (passed: boolean) => {
        return passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50';
    };

    const formatDuration = (ms: number) => {
        if (ms < 1000) {
            return `${ms}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        } else {
            return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
        }
    };

    return (
        <div className="space-y-3">
            {sortedRuns.map((run) => (
                <div
                    key={run.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${selectedRun?.id === run.id
                            ? 'border-blue-300 bg-blue-50 shadow-md'
                            : getStatusColor(run.passed)
                        }`}
                    onClick={() => onRunSelect?.(run)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            {getStatusIcon(run.passed)}
                            <div>
                                <div className="flex items-center space-x-2">
                                    <span className="font-medium">
                                        Run #{run.iteration}
                                    </span>
                                    <span className={`px-2 py-1 text-xs rounded-full ${run.passed
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                        {run.passed ? 'Passed' : 'Failed'}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-600 mt-1">
                                    <span>{formatDuration(run.duration_ms)}</span>
                                    <span className="mx-2">•</span>
                                    <span>{format(new Date(run.created_at), 'MMM d, yyyy HH:mm')}</span>
                                    <span className="mx-2">•</span>
                                    <span>{formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            {/* Artifacts */}
                            {(run.video_url || run.trace_url) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDownloadArtifacts?.(run);
                                    }}
                                    title="Download artifacts"
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                            )}

                            {/* View Details */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRunSelect?.(run);
                                }}
                            >
                                {selectedRun?.id === run.id ? (
                                    <ChevronDown className="h-4 w-4" />
                                ) : (
                                    <ChevronRight className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedRun?.id === run.id && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <h5 className="text-sm font-medium text-gray-900 mb-2">Run Details</h5>
                                    <dl className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <dt className="text-gray-600">ID:</dt>
                                            <dd className="font-mono text-xs">{run.id.slice(0, 8)}...</dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-gray-600">Duration:</dt>
                                            <dd>{formatDuration(run.duration_ms)}</dd>
                                        </div>
                                        <div className="flex justify-between">
                                            <dt className="text-gray-600">Started:</dt>
                                            <dd>{format(new Date(run.created_at), 'HH:mm:ss')}</dd>
                                        </div>
                                    </dl>
                                </div>

                                <div>
                                    <h5 className="text-sm font-medium text-gray-900 mb-2">Artifacts</h5>
                                    <div className="space-y-2">
                                        {run.video_url && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Video Recording</span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => window.open(run.video_url, '_blank')}
                                                >
                                                    <Play className="h-3 w-3 mr-1" />
                                                    View
                                                </Button>
                                            </div>
                                        )}

                                        {run.trace_url && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600">Trace File</span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => window.open(run.trace_url, '_blank')}
                                                >
                                                    <Download className="h-3 w-3 mr-1" />
                                                    Download
                                                </Button>
                                            </div>
                                        )}

                                        {!run.video_url && !run.trace_url && (
                                            <span className="text-sm text-gray-500">No artifacts available</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Logs */}
                            {run.logs && (
                                <div>
                                    <h5 className="text-sm font-medium text-gray-900 mb-2">Logs</h5>
                                    <div className="bg-gray-900 text-green-400 p-3 rounded-md font-mono text-xs max-h-40 overflow-y-auto">
                                        <pre>{run.logs}</pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
