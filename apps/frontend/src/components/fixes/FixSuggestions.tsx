'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface FixSuggestion {
    id: string;
    title: string;
    description: string;
    code: string;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
    reasoning: string;
    alternatives: string[];
    tests_needed: string[];
}

interface FixSuggestionsProps {
    reproId: string;
    errorMessage: string;
    testCode: string;
}

export const FixSuggestions: React.FC<FixSuggestionsProps> = ({
    reproId,
    errorMessage,
    testCode,
}) => {
    const [suggestions, setSuggestions] = useState<FixSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
    const [riskGatePassed, setRiskGatePassed] = useState(false);

    useEffect(() => {
        generateSuggestions();
    }, [reproId, errorMessage, testCode]);

    const generateSuggestions = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/v1/fixes/suggest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    repro_id: reproId,
                    error_message: errorMessage,
                    test_code: testCode,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate fix suggestions');
            }

            const data = await response.json();
            setSuggestions(data.suggestions);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'low': return 'text-green-600 bg-green-50 border-green-200';
            case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'critical': return 'text-red-600 bg-red-50 border-red-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'low': return 'text-green-600';
            case 'medium': return 'text-yellow-600';
            case 'high': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    const getEffortColor = (effort: string) => {
        switch (effort) {
            case 'low': return 'text-green-600';
            case 'medium': return 'text-yellow-600';
            case 'high': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    const handleApplyFix = async (suggestionId: string) => {
        if (!riskGatePassed) {
            alert('Please review and accept the risk assessment before applying this fix.');
            return;
        }

        try {
            const response = await fetch('/api/v1/fixes/apply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    repro_id: reproId,
                    suggestion_id: suggestionId,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to apply fix');
            }

            // Refresh suggestions after applying fix
            generateSuggestions();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const handleRiskGateAccept = () => {
        setRiskGatePassed(true);
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center p-6">
                    <LoadingSpinner />
                    <span className="ml-2">Generating fix suggestions...</span>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="text-red-600 mb-4">Error: {error}</div>
                    <Button onClick={generateSuggestions}>Retry</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Risk Gate */}
            {selectedSuggestion && !riskGatePassed && (
                <Card className="border-orange-200 bg-orange-50">
                    <CardHeader>
                        <CardTitle className="text-orange-800">⚠️ Risk Assessment Required</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-orange-700">
                                You're about to apply a fix that may have significant impact. Please review the risk assessment below.
                            </p>

                            <div className="bg-white p-4 rounded border">
                                <h4 className="font-medium mb-2">Risk Assessment:</h4>
                                <ul className="text-sm space-y-1">
                                    <li>• This fix modifies core functionality</li>
                                    <li>• May affect other parts of the application</li>
                                    <li>• Requires thorough testing before deployment</li>
                                    <li>• Consider running additional test suites</li>
                                </ul>
                            </div>

                            <div className="flex space-x-2">
                                <Button onClick={handleRiskGateAccept} className="bg-orange-600 hover:bg-orange-700">
                                    Accept Risk & Continue
                                </Button>
                                <Button onClick={() => setSelectedSuggestion(null)} variant="outline">
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Fix Suggestions */}
            <div className="space-y-4">
                {suggestions.map((suggestion) => (
                    <Card key={suggestion.id} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                                <div className="flex items-center space-x-2">
                                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getRiskColor(suggestion.risk_level)}`}>
                                        {suggestion.risk_level.toUpperCase()} RISK
                                    </span>
                                    <span className="text-sm text-gray-600">
                                        {Math.round(suggestion.confidence * 100)}% confidence
                                    </span>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent>
                            <div className="space-y-4">
                                <p className="text-gray-700">{suggestion.description}</p>

                                {/* Code Preview */}
                                <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm overflow-x-auto">
                                    <pre>{suggestion.code}</pre>
                                </div>

                                {/* Metrics */}
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="font-medium">Impact:</span>
                                        <span className={`ml-1 ${getImpactColor(suggestion.impact)}`}>
                                            {suggestion.impact.toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-medium">Effort:</span>
                                        <span className={`ml-1 ${getEffortColor(suggestion.effort)}`}>
                                            {suggestion.effort.toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-medium">Risk:</span>
                                        <span className={`ml-1 ${getRiskColor(suggestion.risk_level).split(' ')[0]}`}>
                                            {suggestion.risk_level.toUpperCase()}
                                        </span>
                                    </div>
                                </div>

                                {/* Reasoning */}
                                <div className="bg-blue-50 p-3 rounded">
                                    <h4 className="font-medium text-blue-800 mb-1">AI Reasoning:</h4>
                                    <p className="text-sm text-blue-700">{suggestion.reasoning}</p>
                                </div>

                                {/* Alternatives */}
                                {suggestion.alternatives.length > 0 && (
                                    <div>
                                        <h4 className="font-medium mb-2">Alternative Approaches:</h4>
                                        <ul className="text-sm space-y-1">
                                            {suggestion.alternatives.map((alt, index) => (
                                                <li key={index} className="text-gray-600">• {alt}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Tests Needed */}
                                {suggestion.tests_needed.length > 0 && (
                                    <div>
                                        <h4 className="font-medium mb-2">Tests Needed:</h4>
                                        <ul className="text-sm space-y-1">
                                            {suggestion.tests_needed.map((test, index) => (
                                                <li key={index} className="text-gray-600">• {test}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex space-x-2 pt-2">
                                    <Button
                                        onClick={() => handleApplyFix(suggestion.id)}
                                        disabled={suggestion.risk_level === 'critical' && !riskGatePassed}
                                        className={
                                            suggestion.risk_level === 'critical'
                                                ? 'bg-red-600 hover:bg-red-700'
                                                : 'bg-blue-600 hover:bg-blue-700'
                                        }
                                    >
                                        {suggestion.risk_level === 'critical' ? 'Apply (High Risk)' : 'Apply Fix'}
                                    </Button>

                                    <Button variant="outline" onClick={() => setSelectedSuggestion(suggestion.id)}>
                                        Review Risk
                                    </Button>

                                    <Button variant="outline">
                                        Generate Tests
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {suggestions.length === 0 && (
                <Card>
                    <CardContent className="p-6 text-center text-gray-500">
                        No fix suggestions available for this reproduction.
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
