import { useState } from 'react';
import { Signal } from '@/types/api';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SignalPreview } from './SignalPreview';
import { SignalUpload } from './SignalUpload';
import { toast } from 'react-hot-toast';
import {
    Upload,
    FileText,
    Image,
    Video,
    FileCode,
    Trash2,
    Eye,
    Download
} from 'lucide-react';

interface SignalTrayProps {
    reportId: string;
    signals?: Signal[];
    onSignalUpdate?: () => void;
}

export function SignalTray({ reportId, signals = [], onSignalUpdate }: SignalTrayProps) {
    const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [showUpload, setShowUpload] = useState(false);

    const getSignalIcon = (kind: Signal['kind']) => {
        switch (kind) {
            case 'har':
                return <FileCode className="h-4 w-4" />;
            case 'screenshot':
                return <Image className="h-4 w-4" />;
            case 'video':
                return <Video className="h-4 w-4" />;
            case 'log':
                return <FileText className="h-4 w-4" />;
            default:
                return <FileText className="h-4 w-4" />;
        }
    };

    const getSignalColor = (kind: Signal['kind']) => {
        switch (kind) {
            case 'har':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'screenshot':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'video':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'log':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const handleDeleteSignal = async (signalId: string) => {
        try {
            await apiClient.delete(`/reports/${reportId}/signals/${signalId}`);
            toast.success('Signal deleted successfully');
            onSignalUpdate?.();
        } catch (error) {
            toast.error('Failed to delete signal');
        }
    };

    const handleDownloadSignal = async (signal: Signal) => {
        try {
            if (!signal.s3Key) {
                toast.error('Signal file not available for download');
                return;
            }

            // For now, we'll create a download link
            // In a real implementation, this would generate a signed S3 URL
            const response = await fetch(`/api/signals/${signal.id}/download`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = signal.s3Key.split('/').pop() || 'signal';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                toast.error('Failed to download signal');
            }
        } catch (error) {
            toast.error('Failed to download signal');
        }
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return 'Unknown';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="bg-white rounded-lg border shadow-sm">
            {/* Header */}
            <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold">Signals</h3>
                        <p className="text-sm text-muted-foreground">
                            {signals.length} signal{signals.length !== 1 ? 's' : ''} uploaded
                        </p>
                    </div>
                    <Button
                        onClick={() => setShowUpload(!showUpload)}
                        variant="outline"
                        size="sm"
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Signal
                    </Button>
                </div>
            </div>

            {/* Upload Form */}
            {showUpload && (
                <div className="p-4 border-b bg-gray-50">
                    <SignalUpload
                        reportId={reportId}
                        onUploadComplete={() => {
                            setShowUpload(false);
                            onSignalUpdate?.();
                        }}
                        onUploadStart={() => setIsUploading(true)}
                        onUploadEnd={() => setIsUploading(false)}
                    />
                </div>
            )}

            {/* Signals List */}
            <div className="max-h-96 overflow-y-auto">
                {signals.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No signals uploaded yet</p>
                        <p className="text-sm">Upload HAR files, screenshots, videos, or logs to get started</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {signals.map((signal) => (
                            <div
                                key={signal.id}
                                className="p-4 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        {/* Signal Type Icon */}
                                        <div className={`p-2 rounded-lg ${getSignalColor(signal.kind)}`}>
                                            {getSignalIcon(signal.kind)}
                                        </div>

                                        {/* Signal Info */}
                                        <div>
                                            <div className="flex items-center space-x-2">
                                                <span className="font-medium capitalize">{signal.kind}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDate(signal.createdAt)}
                                                </span>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {signal.s3Key ? signal.s3Key.split('/').pop() : 'No file'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedSignal(signal)}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>

                                        {signal.s3Key && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDownloadSignal(signal)}
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteSignal(signal.id)}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Signal Metadata */}
                                {signal.meta && (
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        {Object.entries(signal.meta).map(([key, value]) => (
                                            <span key={key} className="mr-4">
                                                <strong>{key}:</strong> {String(value)}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Signal Preview Modal */}
            {selectedSignal && (
                <SignalPreview
                    signal={selectedSignal}
                    onClose={() => setSelectedSignal(null)}
                />
            )}

            {/* Loading Overlay */}
            {isUploading && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                    <div className="text-center">
                        <LoadingSpinner />
                        <p className="mt-2 text-sm text-muted-foreground">Uploading signal...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
