import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  BookOpen, 
  Activity, 
  Calendar,
  Download,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

interface AnalyticsData {
  userGrowth: { month: string; users: number }[];
  courseEngagement: { course: string; students: number; assignments: number }[];
  systemUsage: { date: string; activeUsers: number; storageUsed: number }[];
  topCourses: { name: string; enrollment: number; completion: number }[];
  recentActivity: { type: string; description: string; timestamp: string }[];
}

export function AdminAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    userGrowth: [],
    courseEngagement: [],
    systemUsage: [],
    topCourses: [],
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('users');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        
        const response = await axios.get(`${API_URL}/api/admin/analytics?timeRange=${timeRange}`, { headers });
        
        if (response.data.success) {
          // Fetch storage data from stats endpoint
          const statsResponse = await axios.get(`${API_URL}/api/admin/stats`, { headers });
          const storageUsed = statsResponse.data.success ? statsResponse.data.data.storageUsed : 0;
          
          // Add storage data to systemUsage
          const systemUsageWithStorage = response.data.data.systemUsage.map((usage: any) => ({
            ...usage,
            storageUsed: storageUsed
          }));
          
          setAnalyticsData({
            userGrowth: response.data.data.userGrowth || [],
            courseEngagement: response.data.data.courseEngagement || [],
            systemUsage: systemUsageWithStorage || [],
            topCourses: response.data.data.topCourses || [],
            recentActivity: response.data.data.recentActivity || []
          });
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeRange]);

  const getMetricColor = (metric: string) => {
    switch (metric) {
      case 'users': return 'text-blue-600';
      case 'courses': return 'text-green-600';
      case 'activity': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'users': return <Users className="w-5 h-5" />;
      case 'courses': return <BookOpen className="w-5 h-5" />;
      case 'activity': return <Activity className="w-5 h-5" />;
      default: return <BarChart3 className="w-5 h-5" />;
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
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">System performance and user engagement insights</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{analyticsData.userGrowth.reduce((sum, m) => sum + m.users, 0)}</p>
              <p className="text-sm text-gray-500">Total registered</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Courses</p>
              <p className="text-2xl font-bold text-gray-900">{analyticsData.courseEngagement.length}</p>
              <p className="text-sm text-gray-500">Published courses</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Daily Active Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {analyticsData.systemUsage.length > 0 
                  ? analyticsData.systemUsage[analyticsData.systemUsage.length - 1].activeUsers 
                  : 0}
              </p>
              <p className="text-sm text-gray-500">Today</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Activity className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Storage Used</p>
              <p className="text-2xl font-bold text-gray-900">
                {analyticsData.systemUsage.length > 0 
                  ? `${analyticsData.systemUsage[0]?.storageUsed || 0} GB`
                  : '0 GB'}
              </p>
              <p className="text-sm text-gray-500">Total used</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">User Growth</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedMetric('users')}
                className={`p-2 rounded-lg ${selectedMetric === 'users' ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}
              >
                <Users className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedMetric('courses')}
                className={`p-2 rounded-lg ${selectedMetric === 'courses' ? 'bg-green-100 text-green-600' : 'text-gray-400'}`}
              >
                <BookOpen className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedMetric('activity')}
                className={`p-2 rounded-lg ${selectedMetric === 'activity' ? 'bg-purple-100 text-purple-600' : 'text-gray-400'}`}
              >
                <Activity className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="h-64 flex items-end justify-between space-x-2">
            {analyticsData.userGrowth.length > 0 ? (
              analyticsData.userGrowth.map((data, index) => {
                const maxUsers = Math.max(...analyticsData.userGrowth.map(d => d.users), 1);
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-blue-200 rounded-t"
                      style={{ height: `${(data.users / maxUsers) * 200}px` }}
                    ></div>
                    <span className="text-xs text-gray-500 mt-2">{data.month}</span>
                  </div>
                );
              })
            ) : (
              <div className="w-full text-center text-gray-500 py-8">No data available</div>
            )}
          </div>
        </div>

        {/* Course Engagement */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Engagement</h3>
          <div className="space-y-4">
            {analyticsData.courseEngagement.length > 0 ? (
              analyticsData.courseEngagement.map((course, index) => {
                const maxStudents = Math.max(...analyticsData.courseEngagement.map(c => c.students), 1);
                return (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{course.course}</p>
                      <p className="text-xs text-gray-500">{course.students} students</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{course.assignments}</p>
                        <p className="text-xs text-gray-500">assignments</p>
                      </div>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(course.students / maxStudents) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-gray-500 py-4">No course engagement data</div>
            )}
          </div>
        </div>
      </div>

      {/* System Usage and Top Courses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Usage */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Usage</h3>
          <div className="space-y-4">
            {analyticsData.systemUsage.length > 0 ? (
              analyticsData.systemUsage.map((usage, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{usage.activeUsers} active users</p>
                    <p className="text-xs text-gray-500">{usage.storageUsed || 0} GB used</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{new Date(usage.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-4">No system usage data</div>
            )}
          </div>
        </div>

        {/* Top Courses */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Courses</h3>
          <div className="space-y-4">
            {analyticsData.topCourses.length > 0 ? (
              analyticsData.topCourses.map((course, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{course.name}</p>
                    <p className="text-xs text-gray-500">{course.enrollment} enrolled</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{course.completion}</p>
                    <p className="text-xs text-gray-500">completed</p>
                  </div>
                  <div className="w-16 bg-gray-200 rounded-full h-2 ml-4">
                    <div 
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: course.enrollment > 0 ? `${(course.completion / course.enrollment) * 100}%` : '0%' }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-4">No course data</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {analyticsData.recentActivity.length > 0 ? (
            analyticsData.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Activity className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                  <p className="text-xs text-gray-500">{activity.timestamp}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-4">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  );
} 