'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface FrameworkScore {
    [key: string]: number;
}

interface ModuleSuggestion {
    path: string;
    score: number;
}

interface DocResult {
    file_path: string;
    chunk_text: string;
    similarity: number;
    meta?: any;
}

interface MappingResult {
    framework_scores: FrameworkScore;
    module_suggestions: ModuleSuggestion[];
    doc_results: DocResult[];
    confidence_score: number;
}

interface ModuleMapperProps {
    reportId: string;
    projectId: string;
    query?: string;
}

export const ModuleMapper: React.FC<ModuleMapperProps> = ({
    reportId,
    projectId,
    query = '',
}) => {
    const [mapping, setMapping] = useState<MappingResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMapping = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/v1/mappings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    report_id: reportId,
                    project_id: projectId,
                    query,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch mapping');
            }

            const data = await response.json();
            setMapping(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (reportId && projectId) {
            fetchMapping();
        }
    }, [reportId, projectId, query]);

    const getConfidenceColor = (score: number) => {
        if (score >= 0.8) return 'text-green-600';
        if (score >= 0.6) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getConfidenceLabel = (score: number) => {
        if (score >= 0.8) return 'High';
        if (score >= 0.6) return 'Medium';
        return 'Low';
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center p-6">
                    <LoadingSpinner />
                    <span className="ml-2">Analyzing repository...</span>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="text-red-600 mb-4">Error: {error}</div>
                    <Button onClick={fetchMapping}>Retry</Button>
                </CardContent>
            </Card>
        );
    }

    if (!mapping) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Framework Detection */}
            <Card>
                <CardHeader>
                    <CardTitle>Framework Detection</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        {Object.entries(mapping.framework_scores).map(([framework, score]) => (
                            <div key={framework} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                <span className="font-medium capitalize">{framework}</span>
                                <span className={`font-bold ${score > 0.5 ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {(score * 100).toFixed(1)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Module Suggestions */}
            <Card>
                <CardHeader>
                    <CardTitle>Suggested Module Paths</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {mapping.module_suggestions.map((suggestion, index) => (
                            <div
                                key={index}
                                className="flex justify-between items-center p-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer"
                                title={`Relevance score: ${(suggestion.score * 100).toFixed(1)}%`}
                            >
                                <code className="text-sm font-mono">{suggestion.path}</code>
                                <span className="text-sm text-gray-600">
                                    {(suggestion.score * 100).toFixed(1)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Document Search Results */}
            <Card>
                <CardHeader>
                    <CardTitle>Relevant Documentation</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {mapping.doc_results.map((result, index) => (
                            <div key={index} className="border rounded p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <code className="text-sm font-mono text-blue-600">{result.file_path}</code>
                                    <span className="text-sm text-gray-600">
                                        {(result.similarity * 100).toFixed(1)}% match
                                    </span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded text-sm">
                                    <pre className="whitespace-pre-wrap font-mono text-xs">
                                        {result.chunk_text}
                                    </pre>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Confidence Score */}
            <Card>
                <CardHeader>
                    <CardTitle>Mapping Confidence</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-4">
                        <div className="text-2xl font-bold">
                            <span className={getConfidenceColor(mapping.confidence_score)}>
                                {(mapping.confidence_score * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div>
                            <div className={`font-medium ${getConfidenceColor(mapping.confidence_score)}`}>
                                {getConfidenceLabel(mapping.confidence_score)} Confidence
                            </div>
                            <div className="text-sm text-gray-600">
                                Based on framework detection and document relevance
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
