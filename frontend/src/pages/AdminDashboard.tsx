import React, { useState, useEffect } from 'react';
import { getMemoryAuthToken, authFetchInit } from '../utils/authToken';
import { Link } from 'react-router-dom';
import { 
  Users, 
  BookOpen, 
  BarChart3, 
  Settings, 
  Shield, 
  Activity, 
  TrendingUp, 
  AlertTriangle,
  UserCheck,
  UserX,
  FileText,
  Calendar,
  MessageSquare,
  Database,
  Cpu,
  HardDrive
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { API_URL } from '../config';
import { MobileAppShell } from '../components/common/MobileAppShell';

/** How often to refresh stats & activity while the dashboard is open */
const DASHBOARD_POLL_MS = 15_000;

interface SystemStats {
  totalUsers: number;
  totalCourses: number;
  activeUsers: number;
  systemHealth: 'excellent' | 'good' | 'warning' | 'critical';
  storageUsed: number;
  storageTotal: number;
}

interface RecentActivity {
  id: string;
  type: 'user_registration' | 'course_creation' | 'assignment_submission' | 'system_alert';
  description: string;
  timestamp: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export function AdminDashboard() {
  const { user } = useAuth();
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalUsers: 0,
    totalCourses: 0,
    activeUsers: 0,
    systemHealth: 'good',
    storageUsed: 0,
    storageTotal: 1000
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async (isInitial: boolean) => {
      try {
        const token = getMemoryAuthToken();
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };

        const statsResponse = await axios.get(`${API_URL}/api/admin/stats`, { headers });
        const statsPayload = statsResponse.data;
        const stats = statsPayload?.data ?? statsPayload;
        if (
          !cancelled &&
          statsPayload?.success === true &&
          stats &&
          typeof stats === 'object'
        ) {
          setSystemStats({
            totalUsers: Number(stats.totalUsers) || 0,
            totalCourses: Number(stats.totalCourses) || 0,
            activeUsers: Number(stats.activeUsers) || 0,
            systemHealth: (['excellent', 'good', 'warning', 'critical'] as const).includes(
              stats.systemHealth
            )
              ? stats.systemHealth
              : 'good',
            storageUsed: Number(stats.storageUsed) || 0,
            storageTotal: Number(stats.storageTotal) > 0 ? Number(stats.storageTotal) : 1000
          });
        }

        const activityResponse = await axios.get(`${API_URL}/api/admin/activity?limit=10`, { headers });
        const actPayload = activityResponse.data;
        const activities = actPayload?.data ?? actPayload;
        if (!cancelled && actPayload?.success === true && Array.isArray(activities)) {
          setRecentActivity(activities);
        }
      } catch {
        // Keep previous values on error
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    };

    void load(true);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(false);
    }, DASHBOARD_POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) void load(false);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-500 dark:text-green-400';
      case 'good': return 'text-blue-500 dark:text-blue-400';
      case 'warning': return 'text-yellow-500 dark:text-yellow-400';
      case 'critical': return 'text-red-500 dark:text-red-400';
      default: return 'text-gray-500 dark:text-gray-400';
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300';
      case 'critical': return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_registration': return <UserCheck className="w-4 h-4" />;
      case 'course_creation': return <BookOpen className="w-4 h-4" />;
      case 'assignment_submission': return <FileText className="w-4 h-4" />;
      case 'system_alert': return <AlertTriangle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <MobileAppShell title="Admin">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </MobileAppShell>
    );
  }

  return (
    <MobileAppShell title="Admin">
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="hidden lg:block text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">System overview and administrative controls</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getHealthColor(systemStats.systemHealth)}`}></div>
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">System Status: {systemStats.systemHealth}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border-l-4 border-blue-500 dark:border-blue-400">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{systemStats.totalUsers.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border-l-4 border-green-500 dark:border-green-400">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Courses</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{systemStats.totalCourses}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border-l-4 border-purple-500 dark:border-purple-400">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Active Users</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{systemStats.activeUsers}</p>
            </div>
          </div>
        </div>

      </div>

      {/* Storage Usage */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Storage Usage</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Used: {systemStats.storageUsed}GB / {systemStats.storageTotal}GB</span>
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {systemStats.storageTotal > 0
              ? `${Math.round((systemStats.storageUsed / systemStats.storageTotal) * 100)}%`
              : '0%'}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${systemStats.storageTotal > 0 ? Math.min(100, (systemStats.storageUsed / systemStats.storageTotal) * 100) : 0}%`
            }}
          ></div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Link to="/admin/users" className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 hover:shadow-lg dark:hover:shadow-gray-700/50 transition-shadow">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">User Management</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Manage users, roles, and permissions</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/courses" className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 hover:shadow-lg dark:hover:shadow-gray-700/50 transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <BookOpen className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Course Oversight</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Monitor and manage all courses</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/analytics" className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 hover:shadow-lg dark:hover:shadow-gray-700/50 transition-shadow">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Analytics</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">System analytics and reports</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/settings" className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 hover:shadow-lg dark:hover:shadow-gray-700/50 transition-shadow">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
              <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">System Settings</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Configure system parameters</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/security" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg dark:hover:shadow-gray-700/50 transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-lg">
              <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Security</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Security settings and monitoring</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/backup" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg dark:hover:shadow-gray-700/50 transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
              <Database className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Backup & Recovery</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Data backup and system recovery</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="flex flex-col overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
        <div className="shrink-0 border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h3>
        </div>
        <div className="max-h-[min(22rem,42vh)] overflow-y-auto overscroll-y-contain px-6 py-4 sm:max-h-[min(26rem,45vh)]">
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-3 rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className={`shrink-0 rounded-lg p-2 ${getSeverityColor(activity.severity)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{activity.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{activity.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </MobileAppShell>
  );
} 