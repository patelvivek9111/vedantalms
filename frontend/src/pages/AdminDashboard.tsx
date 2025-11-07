import React, { useState, useEffect } from 'react';
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
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../config';

interface SystemStats {
  totalUsers: number;
  totalCourses: number;
  activeUsers: number;
  totalAssignments: number;
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
    totalAssignments: 0,
    systemHealth: 'good',
    storageUsed: 0,
    storageTotal: 1000
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch system stats
        const statsResponse = await axios.get(`${API_URL}/api/admin/stats`, { headers });
        if (statsResponse.data.success) {
          setSystemStats({
            totalUsers: statsResponse.data.data.totalUsers || 0,
            totalCourses: statsResponse.data.data.totalCourses || 0,
            activeUsers: statsResponse.data.data.activeUsers || 0,
            totalAssignments: statsResponse.data.data.totalAssignments || 0,
            systemHealth: statsResponse.data.data.systemHealth || 'good',
            storageUsed: statsResponse.data.data.storageUsed || 0,
            storageTotal: statsResponse.data.data.storageTotal || 1000
          });
        }

        // Fetch recent activity
        const activityResponse = await axios.get(`${API_URL}/api/admin/activity?limit=10`, { headers });
        if (activityResponse.data.success) {
          setRecentActivity(activityResponse.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        // Keep default values on error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">System overview and administrative controls</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getHealthColor(systemStats.systemHealth)}`}></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">System Status: {systemStats.systemHealth}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500 dark:border-blue-400">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{systemStats.totalUsers.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500 dark:border-green-400">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <BookOpen className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Courses</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{systemStats.totalCourses}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-purple-500 dark:border-purple-400">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{systemStats.activeUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500 dark:border-orange-400">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
              <FileText className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Assignments</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{systemStats.totalAssignments}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Usage */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Storage Usage</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Used: {systemStats.storageUsed}GB / {systemStats.storageTotal}GB</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">{Math.round((systemStats.storageUsed / systemStats.storageTotal) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(systemStats.storageUsed / systemStats.storageTotal) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link to="/admin/users" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg dark:hover:shadow-gray-700/50 transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">User Management</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Manage users, roles, and permissions</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/courses" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg dark:hover:shadow-gray-700/50 transition-shadow">
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

        <Link to="/admin/analytics" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg dark:hover:shadow-gray-700/50 transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <BarChart3 className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Analytics</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">System analytics and reports</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/settings" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg dark:hover:shadow-gray-700/50 transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
              <Settings className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">System Settings</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Configure system parameters</p>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div className={`p-2 rounded-lg ${getSeverityColor(activity.severity)}`}>
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{activity.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{activity.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 