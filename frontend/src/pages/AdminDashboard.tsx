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
    // Simulate loading system stats
    setTimeout(() => {
      setSystemStats({
        totalUsers: 1247,
        totalCourses: 89,
        activeUsers: 892,
        totalAssignments: 156,
        systemHealth: 'excellent',
        storageUsed: 234,
        storageTotal: 1000
      });
      setRecentActivity([
        {
          id: '1',
          type: 'user_registration',
          description: 'New student registered: John Doe',
          timestamp: '2 minutes ago',
          severity: 'low'
        },
        {
          id: '2',
          type: 'course_creation',
          description: 'New course created: Advanced Mathematics',
          timestamp: '15 minutes ago',
          severity: 'medium'
        },
        {
          id: '3',
          type: 'system_alert',
          description: 'High storage usage detected',
          timestamp: '1 hour ago',
          severity: 'high'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">System overview and administrative controls</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getHealthColor(systemStats.systemHealth)}`}></div>
            <span className="text-sm text-gray-600">System Status: {systemStats.systemHealth}</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{systemStats.totalUsers.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Courses</p>
              <p className="text-2xl font-bold text-gray-900">{systemStats.totalCourses}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{systemStats.activeUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Assignments</p>
              <p className="text-2xl font-bold text-gray-900">{systemStats.totalAssignments}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Usage */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Usage</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Used: {systemStats.storageUsed}GB / {systemStats.storageTotal}GB</span>
          <span className="text-sm text-gray-600">{Math.round((systemStats.storageUsed / systemStats.storageTotal) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(systemStats.storageUsed / systemStats.storageTotal) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link to="/admin/users" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
              <p className="text-sm text-gray-600">Manage users, roles, and permissions</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/courses" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <BookOpen className="w-8 h-8 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Course Oversight</h3>
              <p className="text-sm text-gray-600">Monitor and manage all courses</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/analytics" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Analytics</h3>
              <p className="text-sm text-gray-600">System analytics and reports</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/system" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Settings className="w-8 h-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">System Settings</h3>
              <p className="text-sm text-gray-600">Configure system parameters</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/security" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-lg">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Security</h3>
              <p className="text-sm text-gray-600">Security settings and monitoring</p>
            </div>
          </div>
        </Link>

        <Link to="/admin/backup" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Database className="w-8 h-8 text-indigo-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Backup & Recovery</h3>
              <p className="text-sm text-gray-600">Data backup and system recovery</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50">
              <div className={`p-2 rounded-lg ${getSeverityColor(activity.severity)}`}>
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                <p className="text-xs text-gray-500">{activity.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 