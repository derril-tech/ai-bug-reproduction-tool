import { useState } from 'react';
import { Report, Signal } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { SignalTray } from './SignalTray';
import { formatDate } from '@/lib/utils';
import {
    Calendar,
    User,
    AlertTriangle,
    AlertCircle,
    Info,
    ChevronDown,
    ChevronRight,
    FileText,
    Image,
    Video,
    Code
} from 'lucide-react';

interface ReportCardProps {
    report: Report;
    signals?: Signal[];
    onView?: (report: Report) => void;
    onEdit?: (report: Report) => void;
    onDelete?: (report: Report) => void;
}

export function ReportCard({
    report,
    signals = [],
    onView,
    onEdit,
    onDelete
}: ReportCardProps) {
    const [expanded, setExpanded] = useState(false);

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical':
                return <AlertTriangle className="h-4 w-4 text-red-600" />;
            case 'high':
                return <AlertCircle className="h-4 w-4 text-orange-600" />;
            case 'medium':
                return <AlertCircle className="h-4 w-4 text-yellow-600" />;
            case 'low':
                return <Info className="h-4 w-4 text-blue-600" />;
            default:
                return <Info className="h-4 w-4 text-gray-600" />;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'high':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'medium':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'low':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getSignalIcon = (kind: Signal['kind']) => {
        switch (kind) {
            case 'har':
                return <Code className="h-3 w-3" />;
            case 'screenshot':
                return <Image className="h-3 w-3" />;
            case 'video':
                return <Video className="h-3 w-3" />;
            case 'log':
                return <FileText className="h-3 w-3" />;
            default:
                return <FileText className="h-3 w-3" />;
        }
    };

    const signalCounts = signals.reduce((acc, signal) => {
        acc[signal.kind] = (acc[signal.kind] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <Card className="w-full">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{report.title}</CardTitle>

                        {report.description && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                {report.description}
                            </p>
                        )}

                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                                <Calendar className="h-4 w-4" />
                                <span>{formatDate(report.createdAt)}</span>
                            </div>

                            {report.reporter && (
                                <div className="flex items-center space-x-1">
                                    <User className="h-4 w-4" />
                                    <span>{report.reporter}</span>
                                </div>
                            )}

                            <div className="flex items-center space-x-1">
                                <span
                                    className={`px-2 py-1 text-xs rounded-full border ${getSeverityColor(report.severity)}`}
                                >
                                    {getSeverityIcon(report.severity)}
                                    <span className="ml-1 capitalize">{report.severity}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* Signal Summary */}
                {signals.length > 0 && (
                    <div className="flex items-center space-x-3 mt-3 pt-3 border-t">
                        <span className="text-sm font-medium">Signals:</span>
                        <div className="flex items-center space-x-2">
                            {Object.entries(signalCounts).map(([kind, count]) => (
                                <div
                                    key={kind}
                                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 rounded-full"
                                >
                                    {getSignalIcon(kind as Signal['kind'])}
                                    <span>{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Environment Info */}
                {report.env && (
                    <div className="mt-3 pt-3 border-t">
                        <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Environment:</span>
                            <div className="mt-1 flex flex-wrap gap-2">
                                {Object.entries(report.env).map(([key, value]) => (
                                    <span
                                        key={key}
                                        className="px-2 py-1 text-xs bg-gray-100 rounded"
                                    >
                                        {key}: {String(value)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </CardHeader>

            {expanded && (
                <CardContent className="pt-0">
                    <div className="space-y-4">
                        {/* Action Buttons */}
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onView?.(report)}
                            >
                                View Details
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onEdit?.(report)}
                            >
                                Edit
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onDelete?.(report)}
                                className="text-red-600 hover:text-red-700"
                            >
                                Delete
                            </Button>
                        </div>

                        {/* Signal Tray */}
                        <SignalTray
                            reportId={report.id}
                            signals={signals}
                            onSignalUpdate={() => {
                                // This would trigger a re-fetch of signals
                                console.log('Signals updated');
                            }}
                        />
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
