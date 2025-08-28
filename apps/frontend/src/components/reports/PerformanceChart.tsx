import { useMemo } from 'react';
import { format } from 'date-fns';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    ComposedChart,
    Area,
    AreaChart
} from 'recharts';
import { TrendingUp, Clock, Target } from 'lucide-react';

interface Run {
    id: string;
    iteration: number;
    passed: boolean;
    duration_ms: number;
    created_at: string;
}

interface PerformanceChartProps {
    runs: Run[];
}

export function PerformanceChart({ runs }: PerformanceChartProps) {
    const chartData = useMemo(() => {
        if (runs.length === 0) return [];

        // Sort runs by iteration
        const sortedRuns = [...runs].sort((a, b) => a.iteration - b.iteration);

        return sortedRuns.map((run, index) => ({
            run: run.iteration,
            duration: run.duration_ms,
            passed: run.passed ? 1 : 0,
            status: run.passed ? 'Passed' : 'Failed',
            timestamp: format(new Date(run.created_at), 'HH:mm'),
            fullTimestamp: run.created_at,
        }));
    }, [runs]);

    const stats = useMemo(() => {
        if (runs.length === 0) {
            return {
                avgDuration: 0,
                minDuration: 0,
                maxDuration: 0,
                medianDuration: 0,
                trend: 'stable',
                improvement: 0,
            };
        }

        const durations = runs.map(r => r.duration_ms);
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const minDuration = Math.min(...durations);
        const maxDuration = Math.max(...durations);
        const sortedDurations = [...durations].sort((a, b) => a - b);
        const medianDuration = sortedDurations[Math.floor(sortedDurations.length / 2)];

        // Calculate trend (improving if last 3 runs are faster than first 3)
        let trend = 'stable';
        if (runs.length >= 6) {
            const firstThree = runs.slice(0, 3).map(r => r.duration_ms);
            const lastThree = runs.slice(-3).map(r => r.duration_ms);
            const firstAvg = firstThree.reduce((a, b) => a + b, 0) / firstThree.length;
            const lastAvg = lastThree.reduce((a, b) => a + b, 0) / lastThree.length;

            const improvement = ((firstAvg - lastAvg) / firstAvg) * 100;

            if (improvement > 10) {
                trend = 'improving';
            } else if (improvement < -10) {
                trend = 'declining';
            }
        }

        return {
            avgDuration,
            minDuration,
            maxDuration,
            medianDuration,
            trend,
        };
    }, [runs]);

    const formatDuration = (ms: number) => {
        if (ms < 1000) {
            return `${ms}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        } else {
            return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
        }
    };

    const formatTooltipDuration = (value: number) => formatDuration(value);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    <p className="font-medium">{`Run #${label}`}</p>
                    <p className="text-sm text-gray-600">{`Duration: ${formatDuration(data.duration)}`}</p>
                    <p className="text-sm text-gray-600">{`Status: ${data.status}`}</p>
                    <p className="text-sm text-gray-600">{`Time: ${data.timestamp}`}</p>
                </div>
            );
        }
        return null;
    };

    if (runs.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <Clock className="h-8 w-8 mx-auto mb-2" />
                <p>No performance data available</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Performance Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-blue-600 font-medium">Average</p>
                            <p className="text-lg font-semibold text-blue-900">
                                {formatDuration(stats.avgDuration)}
                            </p>
                        </div>
                        <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                </div>

                <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-green-600 font-medium">Median</p>
                            <p className="text-lg font-semibold text-green-900">
                                {formatDuration(stats.medianDuration)}
                            </p>
                        </div>
                        <Target className="h-5 w-5 text-green-600" />
                    </div>
                </div>

                <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-purple-600 font-medium">Range</p>
                            <p className="text-lg font-semibold text-purple-900">
                                {formatDuration(stats.minDuration)} - {formatDuration(stats.maxDuration)}
                            </p>
                        </div>
                        <TrendingUp className="h-5 w-5 text-purple-600" />
                    </div>
                </div>

                <div className={`p-3 rounded-lg ${stats.trend === 'improving' ? 'bg-green-50' :
                        stats.trend === 'declining' ? 'bg-red-50' :
                            'bg-gray-50'
                    }`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-sm font-medium ${stats.trend === 'improving' ? 'text-green-600' :
                                    stats.trend === 'declining' ? 'text-red-600' :
                                        'text-gray-600'
                                }`}>Trend</p>
                            <p className={`text-lg font-semibold ${stats.trend === 'improving' ? 'text-green-900' :
                                    stats.trend === 'declining' ? 'text-red-900' :
                                        'text-gray-900'
                                }`}>
                                {stats.trend === 'improving' ? 'Improving' :
                                    stats.trend === 'declining' ? 'Declining' :
                                        'Stable'}
                            </p>
                        </div>
                        <TrendingUp className={`h-5 w-5 ${stats.trend === 'improving' ? 'text-green-600' :
                                stats.trend === 'declining' ? 'text-red-600' :
                                    'text-gray-600'
                            }`} />
                    </div>
                </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-white p-4 rounded-lg border">
                <h4 className="text-sm font-medium text-gray-900 mb-4">Execution Time Trend</h4>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="run"
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => `#${value}`}
                            />
                            <YAxis
                                tick={{ fontSize: 12 }}
                                tickFormatter={formatTooltipDuration}
                            />
                            <Tooltip content={<CustomTooltip />} />

                            {/* Duration line */}
                            <Line
                                type="monotone"
                                dataKey="duration"
                                stroke="#3B82F6"
                                strokeWidth={2}
                                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                            />

                            {/* Pass/fail area */}
                            <Area
                                type="step"
                                dataKey="passed"
                                stroke="#10B981"
                                fill="#10B981"
                                fillOpacity={0.1}
                                strokeWidth={0}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Pass/Fail Distribution */}
            <div className="bg-white p-4 rounded-lg border">
                <h4 className="text-sm font-medium text-gray-900 mb-4">Pass/Fail Distribution</h4>
                <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="run"
                                tick={{ fontSize: 12 }}
                                tickFormatter={(value) => `#${value}`}
                            />
                            <YAxis hide />
                            <Tooltip
                                formatter={(value: any, name: string) => [
                                    value === 1 ? 'Passed' : 'Failed',
                                    'Status'
                                ]}
                            />
                            <Bar
                                dataKey="passed"
                                fill="#10B981"
                                radius={[2, 2, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Performance Insights */}
            {runs.length >= 3 && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <h5 className="text-sm font-medium text-blue-800 mb-2">Performance Insights</h5>
                    <ul className="text-sm text-blue-700 space-y-1">
                        {stats.trend === 'improving' && (
                            <li>• Performance is improving over time</li>
                        )}
                        {stats.trend === 'declining' && (
                            <li>• Performance is declining - investigate recent changes</li>
                        )}
                        {stats.maxDuration - stats.minDuration > stats.avgDuration * 0.5 && (
                            <li>• High variance in execution times detected</li>
                        )}
                        {stats.medianDuration < stats.avgDuration * 0.9 && (
                            <li>• Some runs are significantly faster than average</li>
                        )}
                        <li>• Median execution time: {formatDuration(stats.medianDuration)}</li>
                    </ul>
                </div>
            )}
        </div>
    );
}
