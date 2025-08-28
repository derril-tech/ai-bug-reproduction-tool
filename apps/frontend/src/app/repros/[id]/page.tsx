'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { ModuleMapper } from '../../components/mapping/ModuleMapper';
import { ExportWizard } from '../../components/export/ExportWizard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

interface Repro {
    id: string;
    title: string;
    description: string;
    status: string;
    stability_score: number;
    created_at: string;
    project_id: string;
}

interface ReproDetailPageProps {
    params: {
        id: string;
    };
}

export default function ReproDetailPage({ params }: ReproDetailPageProps) {
    const [repro, setRepro] = useState<Repro | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'mapping' | 'export'>('mapping');

    useEffect(() => {
        fetchRepro();
    }, [params.id]);

    const fetchRepro = async () => {
        try {
            const response = await fetch(`/api/v1/repros/${params.id}`);
            if (!response.ok) {
                throw new Error('Failed to fetch reproduction');
            }
            const data = await response.json();
            setRepro(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LoadingSpinner />
                <span className="ml-2">Loading reproduction...</span>
            </div>
        );
    }

    if (error || !repro) {
        return (
            <div className="container mx-auto p-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="text-red-600 text-center">
                            {error || 'Reproduction not found'}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">{repro.title}</h1>
                <p className="text-gray-600 mb-4">{repro.description}</p>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Status: {repro.status}</span>
                    <span>Stability: {(repro.stability_score * 100).toFixed(1)}%</span>
                    <span>Created: {new Date(repro.created_at).toLocaleDateString()}</span>
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('mapping')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'mapping'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Repository Mapping
                        </button>
                        <button
                            onClick={() => setActiveTab('export')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'export'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Export & Share
                        </button>
                    </nav>
                </div>
            </div>

            {/* Content */}
            {activeTab === 'mapping' && (
                <ModuleMapper
                    reportId={repro.id}
                    projectId={repro.project_id}
                    query={repro.description}
                />
            )}

            {activeTab === 'export' && (
                <ExportWizard
                    reproId={repro.id}
                    reproTitle={repro.title}
                />
            )}
        </div>
    );
}
