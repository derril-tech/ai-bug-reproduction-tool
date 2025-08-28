'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface TraceEvent {
    timestamp: number;
    type: 'dom' | 'state' | 'network' | 'console';
    data: any;
    diff?: {
        added: any[];
        removed: any[];
        modified: any[];
    };
}

interface TraceViewerProps {
    traceId: string;
    reproId: string;
}

export const TraceViewer: React.FC<TraceViewerProps> = ({ traceId, reproId }) => {
    const [events, setEvents] = useState<TraceEvent[]>([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();

    useEffect(() => {
        fetchTrace();
    }, [traceId]);

    useEffect(() => {
        if (isPlaying) {
            animate();
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        }
    }, [isPlaying, currentTime]);

    const fetchTrace = async () => {
        try {
            const response = await fetch(`/api/v1/traces/${traceId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch trace');
            }
            const data = await response.json();
            setEvents(data.events);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const animate = () => {
        if (currentTime >= events[events.length - 1]?.timestamp || 0) {
            setIsPlaying(false);
            return;
        }

        setCurrentTime(prev => prev + 16); // 60fps
        animationRef.current = requestAnimationFrame(animate);
    };

    const renderDOMDiff = (event: TraceEvent) => {
        if (!event.diff) return null;

        return (
            <div className="space-y-2">
                {event.diff.added.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded p-2">
                        <div className="text-sm font-medium text-green-800">Added Elements:</div>
                        {event.diff.added.map((element, index) => (
                            <div key={index} className="text-xs text-green-600 font-mono">
                                + {element.tagName} {element.id ? `#${element.id}` : ''}
                            </div>
                        ))}
                    </div>
                )}

                {event.diff.removed.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-2">
                        <div className="text-sm font-medium text-red-800">Removed Elements:</div>
                        {event.diff.removed.map((element, index) => (
                            <div key={index} className="text-xs text-red-600 font-mono">
                                - {element.tagName} {element.id ? `#${element.id}` : ''}
                            </div>
                        ))}
                    </div>
                )}

                {event.diff.modified.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                        <div className="text-sm font-medium text-yellow-800">Modified Elements:</div>
                        {event.diff.modified.map((element, index) => (
                            <div key={index} className="text-xs text-yellow-600 font-mono">
                                ~ {element.tagName} {element.id ? `#${element.id}` : ''}
                                <div className="ml-4">
                                    {Object.entries(element.changes).map(([key, value]) => (
                                        <div key={key}>
                                            {key}: {JSON.stringify(value)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderStateDiff = (event: TraceEvent) => {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
                <div className="text-sm font-medium text-blue-800">State Changes:</div>
                <pre className="text-xs text-blue-600 font-mono mt-1">
                    {JSON.stringify(event.data, null, 2)}
                </pre>
            </div>
        );
    };

    const renderNetworkEvent = (event: TraceEvent) => {
        return (
            <div className="bg-purple-50 border border-purple-200 rounded p-2">
                <div className="text-sm font-medium text-purple-800">
                    Network: {event.data.method} {event.data.url}
                </div>
                <div className="text-xs text-purple-600">
                    Status: {event.data.status} | Duration: {event.data.duration}ms
                </div>
            </div>
        );
    };

    const renderConsoleEvent = (event: TraceEvent) => {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded p-2">
                <div className="text-sm font-medium text-gray-800">
                    Console: {event.data.level}
                </div>
                <div className="text-xs text-gray-600 font-mono">
                    {event.data.message}
                </div>
            </div>
        );
    };

    const getCurrentEvents = () => {
        return events.filter(event => event.timestamp <= currentTime);
    };

    const formatTime = (timestamp: number) => {
        const seconds = Math.floor(timestamp / 1000);
        const ms = timestamp % 1000;
        return `${seconds}.${ms.toString().padStart(3, '0')}s`;
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center p-6">
                    <LoadingSpinner />
                    <span className="ml-2">Loading trace...</span>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="text-red-600 mb-4">Error: {error}</div>
                    <Button onClick={fetchTrace}>Retry</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Controls */}
            <Card>
                <CardHeader>
                    <CardTitle>Trace Controls</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-4">
                        <Button
                            onClick={() => setIsPlaying(!isPlaying)}
                            variant={isPlaying ? 'outline' : 'default'}
                        >
                            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                        </Button>

                        <Button
                            onClick={() => setCurrentTime(0)}
                            variant="outline"
                        >
                            ⏮️ Reset
                        </Button>

                        <div className="flex-1">
                            <input
                                type="range"
                                min="0"
                                max={events[events.length - 1]?.timestamp || 0}
                                value={currentTime}
                                onChange={(e) => setCurrentTime(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>

                        <div className="text-sm text-gray-600">
                            {formatTime(currentTime)} / {formatTime(events[events.length - 1]?.timestamp || 0)}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
                <CardHeader>
                    <CardTitle>Event Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {getCurrentEvents().map((event, index) => (
                            <div
                                key={index}
                                className={`border rounded p-3 ${event.timestamp === currentTime ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500">
                                            {formatTime(event.timestamp)}
                                        </span>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${event.type === 'dom' ? 'bg-green-100 text-green-800' :
                                                event.type === 'state' ? 'bg-blue-100 text-blue-800' :
                                                    event.type === 'network' ? 'bg-purple-100 text-purple-800' :
                                                        'bg-gray-100 text-gray-800'
                                            }`}>
                                            {event.type.toUpperCase()}
                                        </span>
                                    </div>
                                </div>

                                {event.type === 'dom' && renderDOMDiff(event)}
                                {event.type === 'state' && renderStateDiff(event)}
                                {event.type === 'network' && renderNetworkEvent(event)}
                                {event.type === 'console' && renderConsoleEvent(event)}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Canvas for visual representation */}
            <Card>
                <CardHeader>
                    <CardTitle>Visual Trace</CardTitle>
                </CardHeader>
                <CardContent>
                    <canvas
                        ref={canvasRef}
                        width={800}
                        height={600}
                        className="border border-gray-200 rounded"
                    />
                </CardContent>
            </Card>
        </div>
    );
};
