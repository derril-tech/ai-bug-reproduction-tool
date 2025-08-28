import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Run {
    id: string;
    passed: boolean;
    duration_ms: number;
    created_at: string;
}

interface FlakeMeterProps {
    runs: Run[];
}

export function FlakeMeter({ runs }: FlakeMeterProps) {
    const analysis = useMemo(() => {
        if (runs.length === 0) {
            return {
                stabilityScore: 0,
                flakyScore: 0,
                consistencyScore: 0,
                stabilityClass: 'unknown',
                passRate: 0,
                trend: 'stable',
                recentRuns: [],
            };
        }

        // Calculate basic metrics
        const passedRuns = runs.filter(run => run.passed);
        const failedRuns = runs.filter(run => !run.passed);
        const passRate = passedRuns.length / runs.length;

        // Calculate flaky score (variance in results)
        const results = runs.map(run => run.passed ? 1 : 0);
        const mean = results.reduce((a, b) => a + b, 0) / results.length;
        const variance = results.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / results.length;
        const flakyScore = Math.sqrt(variance) / Math.sqrt(mean * (1 - mean) || 1); // Coefficient of variation

        // Calculate consistency score
        const consistencyScore = 1 - flakyScore;

        // Determine stability class
        let stabilityClass: string;
        let stabilityScore: number;

        if (passRate === 1.0) {
            stabilityClass = 'stable';
            stabilityScore = 1.0;
        } else if (passRate >= 0.8) {
            stabilityClass = 'mostly_stable';
            stabilityScore = 0.8;
        } else if (passRate >= 0.5) {
            stabilityClass = 'unstable';
            stabilityScore = 0.5;
        } else {
            stabilityClass = 'very_unstable';
            stabilityScore = 0.2;
        }

        // Adjust for consistency
        stabilityScore *= consistencyScore;

        // Determine trend based on recent runs
        const recentRuns = runs.slice(-5); // Last 5 runs
        const recentPassRate = recentRuns.filter(r => r.passed).length / recentRuns.length;

        let trend: 'improving' | 'declining' | 'stable';
        if (recentPassRate > passRate + 0.1) {
            trend = 'improving';
        } else if (recentPassRate < passRate - 0.1) {
            trend = 'declining';
        } else {
            trend = 'stable';
        }

        return {
            stabilityScore,
            flakyScore,
            consistencyScore,
            stabilityClass,
            passRate,
            trend,
            recentRuns,
            passedRuns: passedRuns.length,
            failedRuns: failedRuns.length,
            totalRuns: runs.length,
        };
    }, [runs]);

    const getStabilityColor = (stabilityClass: string) => {
        switch (stabilityClass) {
            case 'stable':
                return 'text-green-600 bg-green-100';
            case 'mostly_stable':
                return 'text-blue-600 bg-blue-100';
            case 'unstable':
                return 'text-yellow-600 bg-yellow-100';
            case 'very_unstable':
                return 'text-red-600 bg-red-100';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    };

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'improving':
                return <TrendingUp className="h-4 w-4 text-green-600" />;
            case 'declining':
                return <TrendingDown className="h-4 w-4 text-red-600" />;
            default:
                return <Minus className="h-4 w-4 text-gray-600" />;
        }
    };

    const getStabilityLabel = (stabilityClass: string) => {
        switch (stabilityClass) {
            case 'stable':
                return 'Stable';
            case 'mostly_stable':
                return 'Mostly Stable';
            case 'unstable':
                return 'Unstable';
            case 'very_unstable':
                return 'Very Unstable';
            default:
                return 'Unknown';
        }
    };

    if (runs.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <p>No test runs available for stability analysis</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Main Stability Score */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-medium text-gray-900">Stability Score</h4>
                    <p className="text-2xl font-bold text-gray-900">
                        {Math.round(analysis.stabilityScore * 100)}%
                    </p>
                </div>

                <div className="flex items-center space-x-2">
                    {getTrendIcon(analysis.trend)}
                    <span className={`px-3 py-1 text-sm rounded-full ${getStabilityColor(analysis.stabilityClass)}`}>
                        {getStabilityLabel(analysis.stabilityClass)}
                    </span>
                </div>
            </div>

            {/* Stability Meter */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                        className={`h-3 rounded-full transition-all duration-500 ${analysis.stabilityClass === 'stable' ? 'bg-green-500' :
                                analysis.stabilityClass === 'mostly_stable' ? 'bg-blue-500' :
                                    analysis.stabilityClass === 'unstable' ? 'bg-yellow-500' :
                                        'bg-red-500'
                            }`}
                        style={{ width: `${analysis.stabilityScore * 100}%` }}
                    />
                </div>
            </div>

            {/* Detailed Metrics */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600">Pass Rate</div>
                    <div className="text-lg font-semibold text-gray-900">
                        {Math.round(analysis.passRate * 100)}%
                    </div>
                    <div className="text-xs text-gray-500">
                        {analysis.passedRuns} passed, {analysis.failedRuns} failed
                    </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600">Consistency</div>
                    <div className="text-lg font-semibold text-gray-900">
                        {Math.round(analysis.consistencyScore * 100)}%
                    </div>
                    <div className="text-xs text-gray-500">
                        Lower variance = more consistent
                    </div>
                </div>
            </div>

            {/* Recent Performance */}
            <div className="bg-gray-50 p-3 rounded-lg">
                <h5 className="text-sm font-medium text-gray-900 mb-2">Recent Performance</h5>
                <div className="flex space-x-1">
                    {analysis.recentRuns.slice(-10).map((run, index) => (
                        <div
                            key={run.id}
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${run.passed
                                    ? 'bg-green-500 text-white'
                                    : 'bg-red-500 text-white'
                                }`}
                            title={`${run.passed ? 'Passed' : 'Failed'} - ${run.duration_ms}ms`}
                        >
                            {run.passed ? '✓' : '✗'}
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                    Last {analysis.recentRuns.length} runs
                </p>
            </div>

            {/* Recommendations */}
            {analysis.stabilityScore < 0.8 && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                    <h5 className="text-sm font-medium text-yellow-800 mb-1">Recommendations</h5>
                    <ul className="text-xs text-yellow-700 space-y-1">
                        {analysis.flakyScore > 0.3 && (
                            <li>• High variability detected - consider adding determinism controls</li>
                        )}
                        {analysis.passRate < 0.7 && (
                            <li>• Low pass rate - review test logic and environment setup</li>
                        )}
                        {analysis.trend === 'declining' && (
                            <li>• Performance declining - investigate recent changes</li>
                        )}
                        <li>• Run additional validation cycles to confirm stability</li>
                    </ul>
                </div>
            )}
        </div>
    );
}
