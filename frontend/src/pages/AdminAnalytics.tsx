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
    // Simulate loading analytics data
    setTimeout(() => {
      setAnalyticsData({
        userGrowth: [
          { month: 'Jan', users: 120 },
          { month: 'Feb', users: 150 },
          { month: 'Mar', users: 180 },
          { month: 'Apr', users: 220 },
          { month: 'May', users: 280 },
          { month: 'Jun', users: 320 }
        ],
        courseEngagement: [
          { course: 'Mathematics 101', students: 45, assignments: 12 },
          { course: 'English Literature', students: 38, assignments: 8 },
          { course: 'Computer Science', students: 52, assignments: 15 },
          { course: 'History', students: 29, assignments: 6 },
          { course: 'Physics', students: 41, assignments: 10 }
        ],
        systemUsage: [
          { date: '2024-01-01', activeUsers: 892, storageUsed: 234 },
          { date: '2024-01-02', activeUsers: 945, storageUsed: 238 },
          { date: '2024-01-03', activeUsers: 878, storageUsed: 241 },
          { date: '2024-01-04', activeUsers: 1023, storageUsed: 245 },
          { date: '2024-01-05', activeUsers: 967, storageUsed: 248 }
        ],
        topCourses: [
          { name: 'Mathematics 101', enrollment: 45, completion: 38 },
          { name: 'English Literature', enrollment: 38, completion: 32 },
          { name: 'Computer Science', enrollment: 52, completion: 45 },
          { name: 'History', enrollment: 29, completion: 25 },
          { name: 'Physics', enrollment: 41, completion: 35 }
        ],
        recentActivity: [
          { type: 'user_registration', description: 'New student registered', timestamp: '2 minutes ago' },
          { type: 'course_creation', description: 'New course created: Advanced Physics', timestamp: '15 minutes ago' },
          { type: 'assignment_submission', description: 'High submission rate detected', timestamp: '1 hour ago' },
          { type: 'system_alert', description: 'Storage usage alert', timestamp: '2 hours ago' }
        ]
      });
      setLoading(false);
    }, 1000);
  }, []);

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
              <p className="text-2xl font-bold text-gray-900">1,247</p>
              <p className="text-sm text-green-600">+12% from last month</p>
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
              <p className="text-2xl font-bold text-gray-900">89</p>
              <p className="text-sm text-green-600">+5% from last month</p>
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
              <p className="text-2xl font-bold text-gray-900">892</p>
              <p className="text-sm text-green-600">+8% from last week</p>
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
              <p className="text-2xl font-bold text-gray-900">234 GB</p>
              <p className="text-sm text-yellow-600">23% of total</p>
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
            {analyticsData.userGrowth.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-blue-200 rounded-t"
                  style={{ height: `${(data.users / 320) * 200}px` }}
                ></div>
                <span className="text-xs text-gray-500 mt-2">{data.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Course Engagement */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Engagement</h3>
          <div className="space-y-4">
            {analyticsData.courseEngagement.map((course, index) => (
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
                      style={{ width: `${(course.students / 52) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Usage and Top Courses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Usage */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Usage</h3>
          <div className="space-y-4">
            {analyticsData.systemUsage.map((usage, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{usage.activeUsers} active users</p>
                  <p className="text-xs text-gray-500">{usage.storageUsed} GB used</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{usage.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Courses */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Courses</h3>
          <div className="space-y-4">
            {analyticsData.topCourses.map((course, index) => (
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
                    style={{ width: `${(course.completion / course.enrollment) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {analyticsData.recentActivity.map((activity, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-4 h-4 text-blue-600" />
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