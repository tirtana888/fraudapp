// User Management Section Component
// Clean and minimalist design for managing business users
// UI matches Audit Logs design - clean table, minimal icons, gray tones

import React, { useState, useEffect } from 'react';
import {
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Loader2,
    AlertCircle,
    Users as UsersIcon,
    MoreVertical,
    Shield,
    Ban,
    Trash2,
    CheckCircle,
    UserCog
} from 'lucide-react';
import { useToast } from './Toast';
import {
    getBusinessUsers,
    updateUserRole,
    suspendUser,
    banUser,
    reactivateUser,
    deleteBusinessUser,
    BusinessUser
} from '../services/userManagementService';
import { auth } from '../services/supabase';

export const UserManagementSection: React.FC = () => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [users, setUsers] = useState<BusinessUser[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<BusinessUser[]>([]);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 20;

    // Modals
    const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<BusinessUser | null>(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [newRole, setNewRole] = useState<'user' | 'admin' | 'superadmin'>('user');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [users, searchQuery, roleFilter, statusFilter]);

    const loadUsers = async () => {
        try {
            setIsLoading(true);
            const data = await getBusinessUsers({ limit: 100 });
            setUsers(data);
        } catch (error) {
            console.error('Error loading users:', error);
            toast.error('Failed to load users');
        } finally {
            setIsLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...users];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(user =>
                user.name.toLowerCase().includes(query) ||
                user.email.toLowerCase().includes(query) ||
                user.companyName?.toLowerCase().includes(query)
            );
        }

        // Role filter
        if (roleFilter) {
            filtered = filtered.filter(user => user.role === roleFilter);
        }

        // Status filter
        if (statusFilter) {
            filtered = filtered.filter(user => user.status === statusFilter);
        }

        setFilteredUsers(filtered);
        setCurrentPage(1);
    };

    const formatDate = (date: Date): string => {
        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(new Date(date));
    };

    const maskEmail = (email: string): string => {
        const [username, domain] = email.split('@');
        if (username.length <= 3) return email;
        return `${username.substring(0, 3)}...@${domain}`;
    };

    const getRoleBadgeColor = (role: string): string => {
        const colors: Record<string, string> = {
            user: 'bg-blue-100 text-blue-800',
            admin: 'bg-orange-100 text-orange-800',
            superadmin: 'bg-red-100 text-red-800'
        };
        return colors[role] || 'bg-gray-100 text-gray-800';
    };

    const getStatusBadgeColor = (status: string): string => {
        const colors: Record<string, string> = {
            active: 'bg-green-100 text-green-800',
            suspended: 'bg-yellow-100 text-yellow-800',
            banned: 'bg-red-100 text-red-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const handleChangeRole = async () => {
        if (!selectedUser) return;

        try {
            setIsProcessing(true);
            const adminEmail = auth.currentUser?.email || 'admin@fraudguard.com';
            await updateUserRole(selectedUser.id, newRole, adminEmail);
            toast.success(`User role updated to ${newRole}`);
            setShowRoleModal(false);
            await loadUsers();
        } catch (error) {
            console.error('Error changing role:', error);
            toast.error('Failed to change user role');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSuspend = async (user: BusinessUser) => {
        try {
            const adminEmail = auth.currentUser?.email || 'admin@fraudguard.com';
            await suspendUser(user.id, adminEmail, 'Suspended by admin');
            toast.success('User suspended successfully');
            await loadUsers();
        } catch (error) {
            console.error('Error suspending user:', error);
            toast.error('Failed to suspend user');
        }
    };

    const handleBan = async (user: BusinessUser) => {
        try {
            const adminEmail = auth.currentUser?.email || 'admin@fraudguard.com';
            await banUser(user.id, adminEmail, 'Banned by admin');
            toast.success('User banned successfully');
            await loadUsers();
        } catch (error) {
            console.error('Error banning user:', error);
            toast.error('Failed to ban user');
        }
    };

    const handleReactivate = async (user: BusinessUser) => {
        try {
            const adminEmail = auth.currentUser?.email || 'admin@fraudguard.com';
            await reactivateUser(user.id, adminEmail);
            toast.success('User reactivated successfully');
            await loadUsers();
        } catch (error) {
            console.error('Error reactivating user:', error);
            toast.error('Failed to reactivate user');
        }
    };

    const handleDelete = async () => {
        if (!selectedUser) return;

        try {
            setIsProcessing(true);
            const adminEmail = auth.currentUser?.email || 'admin@fraudguard.com';
            await deleteBusinessUser(selectedUser.id, adminEmail);
            toast.success('User deleted successfully');
            setShowDeleteModal(false);
            await loadUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Failed to delete user');
        } finally {
            setIsProcessing(false);
        }
    };

    // Pagination
    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

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
                    <p className="font-semibold mb-1">User Management</p>
                    <p>Manage business user accounts, roles, and permissions. All actions are logged for security.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Search */}
                    <div className="lg:col-span-2">
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search users..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent text-sm"
                            />
                        </div>
                    </div>

                    {/* Role Filter */}
                    <div>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent text-sm"
                        >
                            <option value="">All Roles</option>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            <option value="superadmin">SuperAdmin</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent text-sm"
                        >
                            <option value="">All Status</option>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="banned">Banned</option>
                        </select>
                    </div>
                </div>

                {/* Active Filters Count */}
                {(searchQuery || roleFilter || statusFilter) && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                        <Filter size={14} />
                        <span>
                            Showing {filteredUsers.length} of {users.length} users
                        </span>
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setRoleFilter('');
                                setStatusFilter('');
                            }}
                            className="text-[#D95D00] hover:underline ml-2"
                        >
                            Clear filters
                        </button>
                    </div>
                )}
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Company
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Joined
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {currentUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                                        {user.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {maskEmail(user.email)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getRoleBadgeColor(user.role)}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusBadgeColor(user.status)}`}>
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {user.companyName || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {formatDate(user.joinedDate)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm relative">
                                        <button
                                            onClick={() => setShowActionMenu(showActionMenu === user.id ? null : user.id)}
                                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                                        >
                                            <MoreVertical size={18} className="text-gray-600" />
                                        </button>

                                        {/* Action Dropdown */}
                                        {showActionMenu === user.id && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                                <div className="py-1">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setNewRole(user.role);
                                                            setShowRoleModal(true);
                                                            setShowActionMenu(null);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                                    >
                                                        <UserCog size={16} />
                                                        Change Role
                                                    </button>
                                                    {user.status === 'active' ? (
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    handleSuspend(user);
                                                                    setShowActionMenu(null);
                                                                }}
                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-yellow-600"
                                                            >
                                                                <Shield size={16} />
                                                                Suspend User
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    handleBan(user);
                                                                    setShowActionMenu(null);
                                                                }}
                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                                                            >
                                                                <Ban size={16} />
                                                                Ban User
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                handleReactivate(user);
                                                                setShowActionMenu(null);
                                                            }}
                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-600"
                                                        >
                                                            <CheckCircle size={16} />
                                                            Reactivate User
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setShowDeleteModal(true);
                                                            setShowActionMenu(null);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600 border-t border-gray-100"
                                                    >
                                                        <Trash2 size={16} />
                                                        Delete User
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Empty State */}
                {filteredUsers.length === 0 && (
                    <div className="text-center py-12">
                        <UsersIcon size={48} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 mb-1">No users found</p>
                        <p className="text-sm text-gray-400">
                            {users.length === 0
                                ? 'No users in the system yet'
                                : 'Try adjusting your filters'}
                        </p>
                    </div>
                )}

                {/* Pagination */}
                {filteredUsers.length > usersPerPage && (
                    <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            Showing {indexOfFirstUser + 1} to {Math.min(indexOfLastUser, filteredUsers.length)} of {filteredUsers.length} users
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

            {/* Role Change Modal */}
            {showRoleModal && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Change User Role</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Change role for <span className="font-semibold">{selectedUser.email}</span>
                        </p>
                        <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value as any)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#D95D00] focus:border-transparent mb-6"
                        >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            <option value="superadmin">SuperAdmin</option>
                        </select>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowRoleModal(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleChangeRole}
                                disabled={isProcessing}
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-[#D95D00] to-[#FF8C00] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                            >
                                {isProcessing ? 'Changing...' : 'Change Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold text-red-600 mb-4">Delete User</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Are you sure you want to permanently delete <span className="font-semibold">{selectedUser.email}</span>?
                        </p>
                        <p className="text-sm text-red-600 mb-6">
                            This action cannot be undone!
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isProcessing}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
                            >
                                {isProcessing ? 'Deleting...' : 'Delete User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
