import React, { useState, useEffect } from 'react';
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
    // Simulate loading security data
    setTimeout(() => {
      setSecurityStats({
        totalLogins: 1247,
        failedLogins: 23,
        suspiciousActivities: 5,
        blockedIPs: 3,
        securityScore: 85
      });
      setSecurityEvents([
        {
          id: '1',
          type: 'failed_login',
          description: 'Failed login attempt from 192.168.1.100',
          timestamp: '2 minutes ago',
          severity: 'medium',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        {
          id: '2',
          type: 'suspicious_activity',
          description: 'Multiple rapid login attempts detected',
          timestamp: '15 minutes ago',
          severity: 'high',
          ipAddress: '203.0.113.45',
          userAgent: 'Mozilla/5.0 (Unknown)'
        },
        {
          id: '3',
          type: 'system_alert',
          description: 'Security scan completed - no threats found',
          timestamp: '1 hour ago',
          severity: 'low'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
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
          <h1 className="text-3xl font-bold text-gray-900">Security Center</h1>
          <p className="text-gray-600">Monitor and manage system security</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-600">Security Score: <span className={getSecurityScoreColor(securityStats.securityScore)}>{securityStats.securityScore}%</span></span>
          </div>
        </div>
      </div>

      {/* Security Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Logins</p>
              <p className="text-2xl font-bold text-gray-900">{securityStats.totalLogins}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Failed Logins</p>
              <p className="text-2xl font-bold text-gray-900">{securityStats.failedLogins}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Suspicious Activities</p>
              <p className="text-2xl font-bold text-gray-900">{securityStats.suspiciousActivities}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Lock className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Blocked IPs</p>
              <p className="text-2xl font-bold text-gray-900">{securityStats.blockedIPs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Security Score</p>
              <p className={`text-2xl font-bold ${getSecurityScoreColor(securityStats.securityScore)}`}>{securityStats.securityScore}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Configuration */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Configuration</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-xs text-gray-500">Require 2FA for all users</p>
              </div>
              <button className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700">
                Enabled
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">IP Whitelist</p>
                <p className="text-xs text-gray-500">Restrict access to specific IPs</p>
              </div>
              <button className="bg-gray-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-gray-700">
                Disabled
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Session Timeout</p>
                <p className="text-xs text-gray-500">Auto-logout after inactivity</p>
              </div>
              <span className="text-sm text-gray-900">30 minutes</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Password Policy</p>
                <p className="text-xs text-gray-500">Minimum requirements</p>
              </div>
              <span className="text-sm text-gray-900">8+ chars, mixed case</span>
            </div>
          </div>
        </div>

        {/* Recent Security Events */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Security Events</h3>
          <div className="space-y-3">
            {securityEvents.map((event) => (
              <div key={event.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50">
                <div className={`p-2 rounded-lg ${getSeverityColor(event.severity)}`}>
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{event.description}</p>
                  <p className="text-xs text-gray-500">{event.timestamp}</p>
                  {event.ipAddress && (
                    <p className="text-xs text-gray-400">IP: {event.ipAddress}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Security Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center justify-center space-x-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-900">Run Security Scan</span>
          </button>
          
          <button className="flex items-center justify-center space-x-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Database className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-900">Backup Security Logs</span>
          </button>
          
          <button className="flex items-center justify-center space-x-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Key className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-900">Generate Security Report</span>
          </button>
        </div>
      </div>
    </div>
  );
} 