import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FlakeMeter } from './FlakeMeter';
import { RunTimeline } from './RunTimeline';
import { PerformanceChart } from './PerformanceChart';
import {
    Play,
    Square,
    RefreshCw,
    Download,
    Eye,
    Settings,
    TrendingUp,
    Clock,
    CheckCircle,
    XCircle,
} from 'lucide-react';

interface RunnerPanelProps {
    reproId: string;
    onValidationComplete?: (results: any) => void;
}

interface ValidationStatus {
    status: 'idle' | 'running' | 'completed' | 'failed';
    currentRun: number;
    totalRuns: number;
    results?: any;
    error?: string;
}

export function RunnerPanel({ reproId, onValidationComplete }: RunnerPanelProps) {
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>({
        status: 'idle',
        currentRun: 0,
        totalRuns: 0,
    });
    const [runHistory, setRunHistory] = useState<any[]>([]);
    const [selectedRun, setSelectedRun] = useState<any>(null);
    const [showSettings, setShowSettings] = useState(false);

    // Validation settings
    const [runs, setRuns] = useState(5);
    const [enableDeterminism, setEnableDeterminism] = useState(true);
    const [enableVideoRecording, setEnableVideoRecording] = useState(false);
    const [enableTraceRecording, setEnableTraceRecording] = useState(true);

    useEffect(() => {
        loadRunHistory();
        checkValidationStatus();
    }, [reproId]);

    const loadRunHistory = async () => {
        try {
            const response = await apiClient.get(`/repros/${reproId}/runs`);
            setRunHistory(response.data || []);
        } catch (error) {
            console.error('Failed to load run history:', error);
        }
    };

    const checkValidationStatus = async () => {
        // In a real implementation, this would poll for validation status
        // For now, we'll just show the current state
    };

    const startValidation = async () => {
        try {
            setValidationStatus({
                status: 'running',
                currentRun: 0,
                totalRuns: runs,
            });

            const determinism = enableDeterminism ? {
                enable_network_shaping: true,
                enable_time_freezing: true,
                enable_resource_limits: true,
                network_latency_ms: 50,
                network_bandwidth_kbps: 1000,
            } : {};

            const response = await apiClient.post(`/repros/${reproId}/validate`, {
                runs,
                determinism,
                recording: {
                    video: enableVideoRecording,
                    trace: enableTraceRecording,
                },
            });

            // Simulate validation progress
            for (let i = 1; i <= runs; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                setValidationStatus(prev => ({
                    ...prev,
                    currentRun: i,
                }));
            }

            // Complete validation
            setValidationStatus(prev => ({
                ...prev,
                status: 'completed',
                results: response.data,
            }));

            await loadRunHistory();
            onValidationComplete?.(response.data);

        } catch (error: any) {
            setValidationStatus({
                status: 'failed',
                currentRun: 0,
                totalRuns: runs,
                error: error?.response?.data?.detail || 'Validation failed',
            });
        }
    };

    const stopValidation = () => {
        setValidationStatus(prev => ({
            ...prev,
            status: 'idle',
        }));
    };

    const downloadArtifacts = async (run: any) => {
        try {
            if (run.video_url) {
                window.open(run.video_url, '_blank');
            }
            if (run.trace_url) {
                window.open(run.trace_url, '_blank');
            }
        } catch (error) {
            console.error('Failed to download artifacts:', error);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'running':
                return <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />;
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-600" />;
            default:
                return <Clock className="h-4 w-4 text-gray-600" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running':
                return 'bg-blue-100 text-blue-800';
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'failed':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="bg-white rounded-lg border shadow-sm">
            {/* Header */}
            <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        <h3 className="text-lg font-semibold">Test Runner</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(validationStatus.status)}`}>
                            {getStatusIcon(validationStatus.status)}
                            <span className="ml-1 capitalize">{validationStatus.status}</span>
                        </span>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSettings(!showSettings)}
                        >
                            <Settings className="h-4 w-4" />
                        </Button>

                        {validationStatus.status === 'running' ? (
                            <Button variant="outline" size="sm" onClick={stopValidation}>
                                <Square className="h-4 w-4 mr-2" />
                                Stop
                            </Button>
                        ) : (
                            <Button onClick={startValidation} disabled={validationStatus.status === 'running'}>
                                <Play className="h-4 w-4 mr-2" />
                                Run Validation
                            </Button>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                {validationStatus.status === 'running' && (
                    <div className="mt-4">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                            <span>Run {validationStatus.currentRun} of {validationStatus.totalRuns}</span>
                            <span>{Math.round((validationStatus.currentRun / validationStatus.totalRuns) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{
                                    width: `${(validationStatus.currentRun / validationStatus.totalRuns) * 100}%`
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {validationStatus.error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-800">{validationStatus.error}</p>
                    </div>
                )}
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="p-4 border-b bg-gray-50">
                    <h4 className="font-medium mb-3">Validation Settings</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Number of Runs
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={runs}
                                onChange={(e) => setRuns(parseInt(e.target.value) || 5)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={enableDeterminism}
                                    onChange={(e) => setEnableDeterminism(e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm">Enable Determinism Controls</span>
                            </label>

                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={enableVideoRecording}
                                    onChange={(e) => setEnableVideoRecording(e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm">Video Recording</span>
                            </label>

                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={enableTraceRecording}
                                    onChange={(e) => setEnableTraceRecording(e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm">Trace Recording</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Section */}
            <div className="p-4 space-y-6">
                {/* Stability Analysis */}
                {runHistory.length > 0 && (
                    <div>
                        <h4 className="font-medium mb-3">Stability Analysis</h4>
                        <FlakeMeter runs={runHistory} />
                    </div>
                )}

                {/* Performance Chart */}
                {runHistory.length > 0 && (
                    <div>
                        <h4 className="font-medium mb-3">Performance Trends</h4>
                        <PerformanceChart runs={runHistory} />
                    </div>
                )}

                {/* Run Timeline */}
                {runHistory.length > 0 && (
                    <div>
                        <h4 className="font-medium mb-3">Test Runs</h4>
                        <RunTimeline
                            runs={runHistory}
                            onRunSelect={setSelectedRun}
                            selectedRun={selectedRun}
                            onDownloadArtifacts={downloadArtifacts}
                        />
                    </div>
                )}

                {/* Empty State */}
                {runHistory.length === 0 && validationStatus.status === 'idle' && (
                    <div className="text-center py-8">
                        <Play className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            No test runs yet
                        </h3>
                        <p className="text-gray-600 mb-4">
                            Run validation to execute the test case multiple times and analyze stability.
                        </p>
                        <Button onClick={startValidation}>
                            Start Validation
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
