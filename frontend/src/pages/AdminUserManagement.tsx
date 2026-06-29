import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  UserCheck, 
  UserX,
  Shield,
  Mail,
  Phone,
  Calendar,
  Eye,
  EyeOff
} from 'lucide-react';
import { getImageUrl } from '../services/api';
import axios from 'axios';
import { API_URL } from '../config';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { MobileAppShell } from '../components/common/MobileAppShell';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: string;
  createdAt: string;
  profilePicture?: string;
  bio?: string;
}

/** Exclude accounts that have never logged in (no valid lastLogin). */
function hasRecordedLogin(user: User): boolean {
  const raw = user.lastLogin;
  if (raw == null || String(raw).trim() === '') return false;
  const t = new Date(raw).getTime();
  return !Number.isNaN(t);
}

function filterUsersWithLogin(data: User[]): User[] {
  return Array.isArray(data) ? data.filter(hasRecordedLogin) : [];
}

export function AdminUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'student' as 'student' | 'teacher' | 'admin'
  });
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState('');
  const [actionError, setActionError] = useState('');
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'student' as 'student' | 'teacher' | 'admin',
  });
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserError, setEditUserError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        
        const params = new URLSearchParams();
        if (roleFilter !== 'all') params.append('role', roleFilter);
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (searchTerm) params.append('search', searchTerm);
        
        const response = await axios.get(`${API_URL}/api/admin/users?${params.toString()}`, { headers });
        
        if (response.data.success) {
          setUsers(filterUsersWithLogin(response.data.data));
        }
      } catch (error) {
        } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [roleFilter, statusFilter, searchTerm]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300';
      case 'teacher': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300';
      case 'student': return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300';
      case 'inactive': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
      case 'suspended': return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <UserCheck className="w-4 h-4" />;
      case 'inactive': return <UserX className="w-4 h-4" />;
      case 'suspended': return <UserX className="w-4 h-4" />;
      default: return <UserX className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Never';
    }
  };
  
  const formatRelativeDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      return date.toLocaleDateString();
    } catch {
      return 'Never';
    }
  };

  const handleUserAction = (action: string, user: User) => {
    switch (action) {
      case 'edit':
        setSelectedUser(user);
        setEditForm({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        });
        setEditUserError('');
        setShowUserModal(true);
        break;
      case 'delete':
        setDeleteUserError('');
        setUserToDelete(user);
        setShowDeleteConfirm(true);
        break;
      case 'suspend':
        updateUserStatus(user, 'suspended');
        break;
      case 'activate':
        updateUserStatus(user, 'active');
        break;
    }
  };

  const updateUserStatus = async (user: User, status: 'active' | 'suspended') => {
    const previousStatus = user.status;
    // Optimistic update so the row reflects the change immediately.
    setUsers((prev) =>
      prev.map((u) => (u._id === user._id ? { ...u, status } : u))
    );
    setActionError('');
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API_URL}/api/admin/users/${user._id}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err: unknown) {
      // Revert on failure and surface the reason.
      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, status: previousStatus } : u))
      );
      const ax = err as { response?: { data?: { message?: string } } };
      setActionError(
        ax.response?.data?.message ||
          `Failed to ${status === 'suspended' ? 'suspend' : 'reactivate'} user.`
      );
    }
  };

  const saveUserEdit = async () => {
    if (!selectedUser) return;
    setEditUserLoading(true);
    setEditUserError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_URL}/api/admin/users/${selectedUser._id}`,
        {
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          role: editForm.role,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updated = response.data?.data;
      setUsers((prev) =>
        prev.map((u) =>
          u._id === selectedUser._id
            ? {
                ...u,
                firstName: updated?.firstName ?? editForm.firstName,
                lastName: updated?.lastName ?? editForm.lastName,
                email: updated?.email ?? editForm.email,
                role: updated?.role ?? editForm.role,
              }
            : u
        )
      );
      setShowUserModal(false);
      setSelectedUser(null);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setEditUserError(ax.response?.data?.message || 'Failed to update user. Please try again.');
    } finally {
      setEditUserLoading(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleteUserLoading(true);
    setDeleteUserError('');
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/admin/users/${userToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers((prev) => prev.filter((u) => u._id !== userToDelete._id));
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setDeleteUserError(ax.response?.data?.message || 'Failed to delete user. Please try again.');
    } finally {
      setDeleteUserLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserError('');
    setCreateUserLoading(true);

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Use the register endpoint to create a new user
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role
      }, { headers });

      if (response.data.success) {
        // Reset form
        setNewUser({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          role: 'student'
        });
        setShowAddUserModal(false);
        
        // Refresh users list
        const params = new URLSearchParams();
        if (roleFilter !== 'all') params.append('role', roleFilter);
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (searchTerm) params.append('search', searchTerm);
        
        const usersResponse = await axios.get(`${API_URL}/api/admin/users?${params.toString()}`, { headers });
        if (usersResponse.data.success) {
          setUsers(filterUsersWithLogin(usersResponse.data.data));
        }
      }
    } catch (error: any) {
      setCreateUserError(
        error.response?.data?.message || 
        error.response?.data?.errors?.map((e: any) => e.message).join(', ') ||
        'Failed to create user'
      );
    } finally {
      setCreateUserLoading(false);
    }
  };

  if (loading) {
    return (
      <MobileAppShell title="Users" backButtonPath="/dashboard">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MobileAppShell>
    );
  }

  return (
    <MobileAppShell title="Users" backButtonPath="/dashboard">
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div>
          <h1 className="hidden lg:block text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Manage users, roles, and permissions</p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{users.length} users</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="flex items-end">
            <button 
              onClick={() => setShowAddUserModal(true)}
              className="w-full bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              Add User
            </button>
          </div>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 flex items-start justify-between gap-3"
        >
          <p className="text-sm text-red-800 dark:text-red-400">{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError('')}
            aria-label="Dismiss error"
            className="text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Users — mobile cards */}
      <div className="space-y-3 lg:hidden">
        {users.map((user) => (
          <div
            key={user._id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="relative h-10 w-10 flex-shrink-0">
                {user.profilePicture ? (
                  <img
                    className="h-10 w-10 rounded-full border-2 border-gray-200 object-cover dark:border-gray-600"
                    src={user.profilePicture.startsWith('http')
                      ? user.profilePicture
                      : getImageUrl(user.profilePicture)}
                    alt={`${user.firstName} ${user.lastName}`}
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                    <span className="font-semibold text-blue-600 dark:text-blue-300">
                      {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {user.firstName} {user.lastName}
                </div>
                <div className="truncate text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                {user.role}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.status)}`}>
                {getStatusIcon(user.status)}
                {user.status}
              </span>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div>
                <span className="block font-medium text-gray-700 dark:text-gray-300">Last login</span>
                {formatRelativeDate(user.lastLogin)}
              </div>
              <div>
                <span className="block font-medium text-gray-700 dark:text-gray-300">Created</span>
                {formatDate(user.createdAt)}
              </div>
            </div>
            <div className="flex items-center justify-end gap-1 border-t border-gray-100 pt-3 dark:border-gray-700">
              <button
                type="button"
                onClick={() => handleUserAction('edit', user)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center text-blue-600 dark:text-blue-400"
                aria-label="Edit user"
              >
                <Edit className="w-5 h-5" />
              </button>
              {user.status === 'active' ? (
                <button
                  type="button"
                  onClick={() => handleUserAction('suspend', user)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center text-yellow-600 dark:text-yellow-400"
                  aria-label="Suspend user"
                >
                  <UserX className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleUserAction('activate', user)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center text-green-600 dark:text-green-400"
                  aria-label="Activate user"
                >
                  <UserCheck className="w-5 h-5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleUserAction('delete', user)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center text-red-600 dark:text-red-400"
                aria-label="Delete user"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Users Table — desktop */}
      <div className="hidden overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800 lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="relative">
                          {user.profilePicture ? (
                            <img
                              className="h-10 w-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                              src={user.profilePicture.startsWith('http')
                                ? user.profilePicture
                                : getImageUrl(user.profilePicture)}
                              alt={`${user.firstName} ${user.lastName}`}
                              onError={(e) => {
                                // Hide the failed image and show fallback
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) {
                                  fallback.style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          {/* Fallback avatar - always present but hidden when image loads */}
                          <div 
                            className={`h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center ${user.profilePicture ? 'hidden' : ''}`}
                            style={{ display: user.profilePicture ? 'none' : 'flex' }}
                          >
                            <span className="text-blue-600 dark:text-blue-300 font-semibold">
                              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                    <div className="flex items-center">
                      {getStatusIcon(user.status)}
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.status)}`}>
                        {user.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {formatRelativeDate(user.lastLogin)}
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleUserAction('edit', user)}
                        aria-label={`Edit ${user.firstName} ${user.lastName}`}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {user.status === 'active' ? (
                        <button
                          onClick={() => handleUserAction('suspend', user)}
                          aria-label={`Suspend ${user.firstName} ${user.lastName}`}
                          className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUserAction('activate', user)}
                          aria-label={`Activate ${user.firstName} ${user.lastName}`}
                          className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleUserAction('delete', user)}
                        aria-label={`Delete ${user.firstName} ${user.lastName}`}
                        data-regression-id="admin-delete-user"
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Create New User</h3>
            <form onSubmit={handleCreateUser}>
              {createUserError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-800 dark:text-red-400">{createUserError}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Minimum 6 characters"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <select
                    required
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'student' | 'teacher' | 'admin' })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUserModal(false);
                    setCreateUserError('');
                    setNewUser({
                      firstName: '',
                      lastName: '',
                      email: '',
                      password: '',
                      role: 'student'
                    });
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserLoading}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createUserLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Edit User</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                <input
                  type="text"
                  aria-label="First Name"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                <input
                  type="text"
                  aria-label="Last Name"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  aria-label="Email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  aria-label="Role"
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, role: e.target.value as 'student' | 'teacher' | 'admin' }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Account status (active / suspended) is managed from the row actions.
              </p>
            </div>
            {editUserError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{editUserError}</p>
            )}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowUserModal(false)}
                disabled={editUserLoading}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveUserEdit}
                disabled={editUserLoading}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {editUserLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          if (deleteUserLoading) return;
          setShowDeleteConfirm(false);
          setUserToDelete(null);
          setDeleteUserError('');
        }}
        onConfirm={confirmDeleteUser}
        title="Delete User"
        message={
          deleteUserError
            ? `${deleteUserError}`
            : `Are you sure you want to delete ${userToDelete?.firstName} ${userToDelete?.lastName}? This action cannot be undone.`
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleteUserLoading}
      />
    </div>
    </MobileAppShell>
  );
} 