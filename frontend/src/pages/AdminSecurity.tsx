import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye, 
  EyeOff,
  Lock,
  Key,
  Activity,
  Users,
  Database,
  RefreshCw
} from 'lucide-react';

interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'failed_login' | 'suspicious_activity' | 'system_alert';
  description: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ipAddress?: string;
  userAgent?: string;
}

interface SecurityStats {
  totalLogins: number;
  failedLogins: number;
  suspiciousActivities: number;
  blockedIPs: number;
  securityScore: number;
}

export function AdminSecurity() {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [securityStats, setSecurityStats] = useState<SecurityStats>({
    totalLogins: 0,
    failedLogins: 0,
    suspiciousActivities: 0,
    blockedIPs: 0,
    securityScore: 0
  });
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fetchSecurityData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch security stats
        const statsResponse = await axios.get(`${API_URL}/api/admin/security/stats`, { headers });
        if (statsResponse.data.success) {
          setSecurityStats(statsResponse.data.data);
        }

        // Fetch security events (only 5 latest)
        const eventsResponse = await axios.get(`${API_URL}/api/admin/security/events?limit=5`, { headers });
        if (eventsResponse.data.success) {
          setSecurityEvents(eventsResponse.data.data);
        }
      } catch (error) {
        // Keep default values on error
        setSecurityStats({
          totalLogins: 0,
          failedLogins: 0,
          suspiciousActivities: 0,
          blockedIPs: 0,
          securityScore: 100
        });
        setSecurityEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSecurityData();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200';
      case 'critical': return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'login_attempt': return <Users className="w-4 h-4" />;
      case 'failed_login': return <XCircle className="w-4 h-4" />;
      case 'suspicious_activity': return <AlertTriangle className="w-4 h-4" />;
      case 'system_alert': return <Shield className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getSecurityScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Security Center</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Monitor and manage system security</p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Security Score: <span className={getSecurityScoreColor(securityStats.securityScore)}>{securityStats.securityScore}%</span></span>
          </div>
        </div>
      </div>

      {/* Security Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border-l-4 border-green-500 dark:border-green-400">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Total Logins</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{securityStats.totalLogins}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border-l-4 border-red-500 dark:border-red-400">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Failed Logins</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{securityStats.failedLogins}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border-l-4 border-orange-500 dark:border-orange-400">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Suspicious Activities</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{securityStats.suspiciousActivities}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border-l-4 border-purple-500 dark:border-purple-400">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Blocked IPs</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{securityStats.blockedIPs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border-l-4 border-blue-500 dark:border-blue-400">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Security Score</p>
              <p className={`text-xl sm:text-2xl font-bold ${getSecurityScoreColor(securityStats.securityScore)}`}>{securityStats.securityScore}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Security Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Security Configuration</h3>
          <div className="space-y-4">
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-sm">Security configuration settings coming soon</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Configuration options will be available in a future update</p>
            </div>
          </div>
        </div>

        {/* Recent Security Events */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Security Events</h3>
          <div className="space-y-3">
            {securityEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">No security events in the last 30 days</p>
              </div>
            ) : (
              securityEvents.map((event) => {
                const eventDate = new Date(event.timestamp);
                const formattedDate = eventDate.toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                
                return (
                  <div key={event.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className={`p-2 rounded-lg ${getSeverityColor(event.severity)}`}>
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{event.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formattedDate}</p>
                      {event.ipAddress && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">IP: {event.ipAddress}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Security Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Actions</h3>
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">Security actions coming soon</p>
          <p className="text-xs text-gray-400 mt-2">Additional security features will be available in a future update</p>
        </div>
      </div>
    </div>
  );
} 