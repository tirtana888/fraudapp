// Audit Logs Section Component
// Clean and minimalist design for viewing system configuration changes

import React, { useState, useEffect } from 'react';
import {
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Calendar,
    Loader2,
    AlertCircle,
    FileText
} from 'lucide-react';
import { useToast } from './Toast';
import { getAuditLogs, AuditLog } from '../services/systemConfigService';

export const AuditLogsSection: React.FC = () => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [sectionFilter, setSectionFilter] = useState<string>('');
    const [actionFilter, setActionFilter] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const logsPerPage = 20;

    useEffect(() => {
        loadLogs();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [logs, searchQuery, sectionFilter, actionFilter, startDate, endDate]);

    const loadLogs = async () => {
        try {
            setIsLoading(true);
            const data = await getAuditLogs({ limit: 100 });
            setLogs(data);
        } catch (error) {
            console.error('Error loading audit logs:', error);
            toast.error('Failed to load audit logs');
        } finally {
            setIsLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...logs];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(log =>
                log.resource.toLowerCase().includes(query) ||
                log.details.toLowerCase().includes(query) ||
                log.userEmail.toLowerCase().includes(query)
            );
        }

        // Section filter
        if (sectionFilter) {
            filtered = filtered.filter(log => log.section === sectionFilter);
        }

        // Action filter
        if (actionFilter) {
            filtered = filtered.filter(log => log.action === actionFilter);
        }

        // Date range filter
        if (startDate) {
            const start = new Date(startDate);
            filtered = filtered.filter(log => new Date(log.timestamp) >= start);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(log => new Date(log.timestamp) <= end);
        }

        setFilteredLogs(filtered);
        setCurrentPage(1); // Reset to first page when filters change
    };

    const formatTimestamp = (date: Date): string => {
        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    };

    const maskEmail = (email: string): string => {
        const [username, domain] = email.split('@');
        if (username.length <= 3) return email;
        return `${username.substring(0, 3)}...@${domain}`;
    };

    const getSectionLabel = (section: string): string => {
        const labels: Record<string, string> = {
            'api-keys': 'API Keys',
            'settings': 'Settings',
            'webhooks': 'Webhooks'
        };
        return labels[section] || section;
    };

    // Pagination
    const indexOfLastLog = currentPage * logsPerPage;
    const indexOfFirstLog = indexOfLastLog - logsPerPage;
    const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
    const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={48} className="text-[#D95D00] animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Audit Trail</p>
                    <p>Track all changes made to system configuration. Logs are retained for compliance and security purposes.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Search */}
                    <div className="lg:col-span-2">
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search logs..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent text-sm"
                            />
                        </div>
                    </div>

                    {/* Section Filter */}
                    <div>
                        <select
                            value={sectionFilter}
                            onChange={(e) => setSectionFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent text-sm"
                        >
                            <option value="">All Sections</option>
                            <option value="api-keys">API Keys</option>
                            <option value="settings">Settings</option>
                            <option value="webhooks">Webhooks</option>
                        </select>
                    </div>

                    {/* Action Filter */}
                    <div>
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent text-sm"
                        >
                            <option value="">All Actions</option>
                            <option value="created">Created</option>
                            <option value="updated">Updated</option>
                            <option value="deleted">Deleted</option>
                            <option value="toggled">Toggled</option>
                        </select>
                    </div>

                    {/* Date Range */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full pl-9 pr-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent text-sm"
                            />
                        </div>
                        <span className="text-gray-400">-</span>
                        <div className="relative flex-1">
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Active Filters Count */}
                {(searchQuery || sectionFilter || actionFilter || startDate || endDate) && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                        <Filter size={14} />
                        <span>
                            Showing {filteredLogs.length} of {logs.length} logs
                        </span>
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setSectionFilter('');
                                setActionFilter('');
                                setStartDate('');
                                setEndDate('');
                            }}
                            className="text-[#D95D00] hover:underline ml-2"
                        >
                            Clear filters
                        </button>
                    </div>
                )}
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Timestamp
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    User
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Action
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Section
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Details
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {currentLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                                        {formatTimestamp(log.timestamp)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {maskEmail(log.userEmail)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm text-gray-800 capitalize">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {getSectionLabel(log.section)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-800">
                                        <div className="max-w-md">
                                            <p className="font-medium">{log.resource}</p>
                                            <p className="text-gray-600 text-xs mt-0.5">{log.details}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${log.status === 'success'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}>
                                            {log.status === 'success' ? 'Success' : 'Error'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Empty State */}
                {filteredLogs.length === 0 && (
                    <div className="text-center py-12">
                        <FileText size={48} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 mb-1">No audit logs found</p>
                        <p className="text-sm text-gray-400">
                            {logs.length === 0
                                ? 'No configuration changes have been made yet'
                                : 'Try adjusting your filters'}
                        </p>
                    </div>
                )}

                {/* Pagination */}
                {filteredLogs.length > logsPerPage && (
                    <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            Showing {indexOfFirstLog + 1} to {Math.min(indexOfLastLog, filteredLogs.length)} of {filteredLogs.length} logs
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-sm text-gray-600">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
