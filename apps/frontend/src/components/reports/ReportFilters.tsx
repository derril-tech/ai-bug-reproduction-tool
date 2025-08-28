import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
    Filter,
    Search,
    X,
    Calendar,
    AlertTriangle,
    CheckCircle,
    Clock
} from 'lucide-react';

export function ReportFilters() {
    const [searchTerm, setSearchTerm] = useState('');
    const [severityFilter, setSeverityFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<string>('all');

    const severityOptions = [
        { value: 'all', label: 'All Severities' },
        { value: 'critical', label: 'Critical' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
    ];

    const statusOptions = [
        { value: 'all', label: 'All Statuses' },
        { value: 'open', label: 'Open' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'closed', label: 'Closed' },
    ];

    const dateOptions = [
        { value: 'all', label: 'All Time' },
        { value: 'today', label: 'Today' },
        { value: 'week', label: 'This Week' },
        { value: 'month', label: 'This Month' },
        { value: 'quarter', label: 'This Quarter' },
    ];

    const hasActiveFilters =
        searchTerm ||
        severityFilter !== 'all' ||
        statusFilter !== 'all' ||
        dateFilter !== 'all';

    const clearFilters = () => {
        setSearchTerm('');
        setSeverityFilter('all');
        setStatusFilter('all');
        setDateFilter('all');
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical':
                return <AlertTriangle className="h-4 w-4 text-red-600" />;
            case 'high':
                return <AlertTriangle className="h-4 w-4 text-orange-600" />;
            case 'medium':
                return <Clock className="h-4 w-4 text-yellow-600" />;
            case 'low':
                return <CheckCircle className="h-4 w-4 text-blue-600" />;
            default:
                return null;
        }
    };

    return (
        <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <Filter className="h-5 w-5 text-gray-600" />
                    <h3 className="font-medium">Filters</h3>
                </div>

                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="text-gray-600 hover:text-gray-800"
                    >
                        <X className="h-4 w-4 mr-1" />
                        Clear Filters
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search reports..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Severity Filter */}
                <div>
                    <select
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {severityOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Status Filter */}
                <div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Date Filter */}
                <div>
                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {dateOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
                <div className="mt-4 pt-4 border-t">
                    <div className="flex flex-wrap gap-2">
                        {searchTerm && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                                Search: "{searchTerm}"
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="ml-2 text-blue-600 hover:text-blue-800"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        )}

                        {severityFilter !== 'all' && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">
                                {getSeverityIcon(severityFilter)}
                                <span className="ml-1 capitalize">{severityFilter}</span>
                                <button
                                    onClick={() => setSeverityFilter('all')}
                                    className="ml-2 text-red-600 hover:text-red-800"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        )}

                        {statusFilter !== 'all' && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                                {statusFilter.replace('-', ' ')}
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className="ml-2 text-green-600 hover:text-green-800"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        )}

                        {dateFilter !== 'all' && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                                <Calendar className="h-3 w-3 mr-1" />
                                {dateFilter}
                                <button
                                    onClick={() => setDateFilter('all')}
                                    className="ml-2 text-purple-600 hover:text-purple-800"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
