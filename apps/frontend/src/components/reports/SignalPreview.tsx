import { useState, useEffect } from 'react';
import { Signal } from '@/types/api';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
    X,
    FileText,
    Image,
    Video,
    FileCode,
    Download,
    Maximize2,
    ExternalLink
} from 'lucide-react';

interface SignalPreviewProps {
    signal: Signal;
    onClose: () => void;
}

export function SignalPreview({ signal, onClose }: SignalPreviewProps) {
    const [content, setContent] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        loadSignalContent();
    }, [signal]);

    const loadSignalContent = async () => {
        setLoading(true);
        setError(null);

        try {
            // For now, we'll just show metadata
            // In a real implementation, this would fetch the actual file content
            // or generate a preview based on the signal type
            setContent({
                type: signal.kind,
                metadata: signal.meta || {},
                s3Key: signal.s3Key,
                createdAt: signal.createdAt,
            });
        } catch (err) {
            setError('Failed to load signal content');
        } finally {
            setLoading(false);
        }
    };

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <LoadingSpinner />
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex items-center justify-center h-64 text-red-600">
                    <div className="text-center">
                        <p className="font-medium">Error loading signal</p>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            );
        }

        if (!content) return null;

        switch (signal.kind) {
            case 'screenshot':
                return renderScreenshotPreview();
            case 'video':
                return renderVideoPreview();
            case 'har':
                return renderHarPreview();
            case 'log':
                return renderLogPreview();
            default:
                return renderDefaultPreview();
        }
    };

    const renderScreenshotPreview = () => {
        return (
            <div className="space-y-4">
                <div className="text-center">
                    <Image className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Screenshot Preview</p>
                    <p className="text-xs text-gray-500">
                        Full image would be displayed here
                    </p>
                </div>

                {content.metadata && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Image Metadata</h4>
                        <dl className="space-y-1 text-sm">
                            {Object.entries(content.metadata).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                    <dt className="font-medium">{key}:</dt>
                                    <dd className="text-gray-600">{String(value)}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                )}
            </div>
        );
    };

    const renderVideoPreview = () => {
        return (
            <div className="space-y-4">
                <div className="text-center">
                    <Video className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Video Preview</p>
                    <p className="text-xs text-gray-500">
                        Video player would be displayed here
                    </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-800">
                        <strong>Audio Transcription:</strong> This video will be processed for speech-to-text
                        content extraction to help with bug reproduction.
                    </p>
                </div>
            </div>
        );
    };

    const renderHarPreview = () => {
        return (
            <div className="space-y-4">
                <div className="flex items-center space-x-2">
                    <FileCode className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">HAR File</span>
                </div>

                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{JSON.stringify(content.metadata, null, 2)}</pre>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                        This HAR file will be analyzed for network patterns, failed requests,
                        and performance issues that may be related to the reported bug.
                    </p>
                </div>
            </div>
        );
    };

    const renderLogPreview = () => {
        return (
            <div className="space-y-4">
                <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-orange-600" />
                    <span className="font-medium">Log File</span>
                </div>

                <div className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                    <pre>
                        {`[2024-01-15 10:30:00] INFO Starting application
[2024-01-15 10:30:05] ERROR TypeError: Cannot read property 'map' of undefined
    at CheckoutPage.handleCoupon (/app/cart.js:45:12)
[2024-01-15 10:30:10] WARN Failed to process coupon
[2024-01-15 10:30:15] INFO Processing completed`}
                    </pre>
                </div>

                <div className="bg-orange-50 p-3 rounded-lg">
                    <p className="text-sm text-orange-800">
                        Log files are analyzed for error patterns, stack traces, and
                        contextual information that helps identify the root cause of bugs.
                    </p>
                </div>
            </div>
        );
    };

    const renderDefaultPreview = () => {
        return (
            <div className="space-y-4">
                <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Signal Preview</p>
                    <p className="text-xs text-gray-500">
                        Preview for {signal.kind} signals
                    </p>
                </div>

                {content.metadata && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-2">Signal Metadata</h4>
                        <dl className="space-y-1 text-sm">
                            {Object.entries(content.metadata).map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                    <dt className="font-medium">{key}:</dt>
                                    <dd className="text-gray-600">{String(value)}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                )}
            </div>
        );
    };

    const handleDownload = async () => {
        if (!signal.s3Key) {
            alert('Signal file not available for download');
            return;
        }

        try {
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
            }
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const modalClasses = isFullscreen
        ? 'fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4'
        : 'fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4';

    const contentClasses = isFullscreen
        ? 'bg-white rounded-lg w-full h-full max-w-none max-h-none overflow-auto'
        : 'bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto';

    return (
        <div className={modalClasses} onClick={onClose}>
            <div className={contentClasses} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold">Signal Preview</h3>
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 capitalize">
                            {signal.kind}
                        </span>
                    </div>

                    <div className="flex items-center space-x-2">
                        {signal.s3Key && (
                            <Button variant="outline" size="sm" onClick={handleDownload}>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                            <Maximize2 className="h-4 w-4" />
                        </Button>

                        <Button variant="outline" size="sm" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {renderContent()}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                    <div className="text-sm text-gray-600">
                        Created: {new Date(signal.createdAt).toLocaleString()}
                    </div>

                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span>ID: {signal.id.slice(0, 8)}...</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
