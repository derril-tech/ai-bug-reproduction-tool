'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface Export {
    id: string;
    type: 'pr' | 'sandbox' | 'docker' | 'report';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: any;
    created_at: string;
}

interface ExportWizardProps {
    reproId: string;
    reproTitle: string;
}

export const ExportWizard: React.FC<ExportWizardProps> = ({
    reproId,
    reproTitle,
}) => {
    const [exports, setExports] = useState<Export[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<'pr' | 'sandbox' | 'docker' | 'report'>('pr');
    const [exportOptions, setExportOptions] = useState({
        repo_url: '',
        branch_name: '',
        platform: 'codesandbox',
        format: 'pdf',
    });

    const fetchExports = async () => {
        try {
            const response = await fetch(`/api/v1/exports/repro/${reproId}`);
            if (response.ok) {
                const data = await response.json();
                setExports(data.exports || []);
            }
        } catch (err) {
            console.error('Failed to fetch exports:', err);
        }
    };

    useEffect(() => {
        fetchExports();
    }, [reproId]);

    const createExport = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/v1/exports/${selectedType}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    repro_id: reproId,
                    options: exportOptions,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create export');
            }

            const newExport = await response.json();
            setExports(prev => [newExport, ...prev]);

            // Poll for status updates
            pollExportStatus(newExport.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const pollExportStatus = async (exportId: string) => {
        const poll = async () => {
            try {
                const response = await fetch(`/api/v1/exports/${exportId}`);
                if (response.ok) {
                    const export_ = await response.json();
                    setExports(prev =>
                        prev.map(exp => exp.id === exportId ? export_ : exp)
                    );

                    if (export_.status === 'pending' || export_.status === 'processing') {
                        setTimeout(poll, 2000);
                    }
                }
            } catch (err) {
                console.error('Failed to poll export status:', err);
            }
        };

        setTimeout(poll, 2000);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-600';
            case 'processing': return 'text-blue-600';
            case 'failed': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return '✅';
            case 'processing': return '⏳';
            case 'failed': return '❌';
            default: return '⏸️';
        }
    };

    const renderExportResult = (export_: Export) => {
        if (export_.status !== 'completed' || !export_.result) {
            return null;
        }

        switch (export_.type) {
            case 'pr':
                return (
                    <div className="mt-2">
                        <a
                            href={export_.result.pr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                        >
                            View Pull Request #{export_.result.pr_number}
                        </a>
                    </div>
                );

            case 'sandbox':
                return (
                    <div className="mt-2">
                        <a
                            href={export_.result.sandbox_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                        >
                            Open in {export_.result.platform}
                        </a>
                    </div>
                );

            case 'docker':
                return (
                    <div className="mt-2">
                        <code className="text-sm bg-gray-100 p-2 rounded">
                            docker load -i {export_.result.tarball_path}
                        </code>
                    </div>
                );

            case 'report':
                return (
                    <div className="mt-2">
                        <a
                            href={`/api/v1/exports/${export_.id}/download`}
                            className="text-blue-600 hover:text-blue-800 underline"
                        >
                            Download {exportOptions.format.toUpperCase()} Report
                        </a>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Export Options */}
            <Card>
                <CardHeader>
                    <CardTitle>Export Options</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {/* Export Type Selection */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Export Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['pr', 'sandbox', 'docker', 'report'] as const).map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setSelectedType(type)}
                                        className={`p-3 rounded border ${selectedType === type
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                    >
                                        <div className="font-medium capitalize">{type}</div>
                                        <div className="text-xs text-gray-600">
                                            {type === 'pr' && 'Create GitHub PR'}
                                            {type === 'sandbox' && 'CodeSandbox/StackBlitz'}
                                            {type === 'docker' && 'Docker tarball'}
                                            {type === 'report' && 'PDF/JSON report'}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Type-specific options */}
                        {selectedType === 'pr' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Repository URL</label>
                                    <input
                                        type="url"
                                        value={exportOptions.repo_url}
                                        onChange={(e) => setExportOptions(prev => ({ ...prev, repo_url: e.target.value }))}
                                        placeholder="https://github.com/owner/repo"
                                        className="w-full p-2 border rounded"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Branch Name</label>
                                    <input
                                        type="text"
                                        value={exportOptions.branch_name}
                                        onChange={(e) => setExportOptions(prev => ({ ...prev, branch_name: e.target.value }))}
                                        placeholder={`bug-repro-${reproId.slice(0, 8)}`}
                                        className="w-full p-2 border rounded"
                                    />
                                </div>
                            </div>
                        )}

                        {selectedType === 'sandbox' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Platform</label>
                                <select
                                    value={exportOptions.platform}
                                    onChange={(e) => setExportOptions(prev => ({ ...prev, platform: e.target.value }))}
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="codesandbox">CodeSandbox</option>
                                    <option value="stackblitz">StackBlitz</option>
                                </select>
                            </div>
                        )}

                        {selectedType === 'report' && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Format</label>
                                <select
                                    value={exportOptions.format}
                                    onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value }))}
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="pdf">PDF</option>
                                    <option value="json">JSON</option>
                                </select>
                            </div>
                        )}

                        <Button
                            onClick={createExport}
                            disabled={loading}
                            className="w-full"
                        >
                            {loading ? (
                                <>
                                    <LoadingSpinner />
                                    <span className="ml-2">Creating Export...</span>
                                </>
                            ) : (
                                `Create ${selectedType.toUpperCase()} Export`
                            )}
                        </Button>

                        {error && (
                            <div className="text-red-600 text-sm">{error}</div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Export History */}
            <Card>
                <CardHeader>
                    <CardTitle>Export History</CardTitle>
                </CardHeader>
                <CardContent>
                    {exports.length === 0 ? (
                        <div className="text-gray-500 text-center py-4">
                            No exports yet. Create your first export above.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {exports.map((export_) => (
                                <div key={export_.id} className="border rounded p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <span className="text-lg">{getStatusIcon(export_.status)}</span>
                                            <div>
                                                <div className="font-medium capitalize">{export_.type} Export</div>
                                                <div className="text-sm text-gray-600">
                                                    {new Date(export_.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`font-medium ${getStatusColor(export_.status)}`}>
                                            {export_.status}
                                        </div>
                                    </div>
                                    {renderExportResult(export_)}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
