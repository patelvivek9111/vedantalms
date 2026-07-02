import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { getMemoryAuthToken } from '../utils/authToken';
import { MobileAppShell } from '../components/common/MobileAppShell';
import {
  fetchSecurityConfig,
  fetchSecurityPosture,
  patchSecurityConfig,
  downloadLoginLog,
  type PostureCheck,
  type SecurityConfig,
} from '../services/adminSecurityApi';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Lock,
  Activity,
  Users,
  Download,
  Save,
  RefreshCw,
} from 'lucide-react';

interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'failed_login' | 'suspicious_activity' | 'system_alert';
  description: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ipAddress?: string;
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
    securityScore: 100,
  });
  const [posture, setPosture] = useState<PostureCheck[]>([]);
  const [postureSummary, setPostureSummary] = useState({ passed: 0, total: 0 });
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [draft, setDraft] = useState({
    passwordMinLength: 8,
    requireStrongPassword: true,
    maxLoginAttempts: 5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [message, setMessage] = useState('');

  const headers = () => ({ Authorization: `Bearer ${getMemoryAuthToken()}` });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, eventsRes, postureRes, configRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/security/stats`, { headers: headers() }),
        axios.get(`${API_URL}/api/admin/security/events?limit=5`, { headers: headers() }),
        fetchSecurityPosture(),
        fetchSecurityConfig(),
      ]);

      if (statsRes.data.success) setSecurityStats(statsRes.data.data);
      if (eventsRes.data.success) setSecurityEvents(eventsRes.data.data);
      if (postureRes.success) {
        setPosture(postureRes.data.checks);
        setPostureSummary(postureRes.data.summary);
      }
      if (configRes.success) {
        setConfig(configRes.data);
        setDraft({
          passwordMinLength: configRes.data.passwordMinLength,
          requireStrongPassword: configRes.data.requireStrongPassword,
          maxLoginAttempts: configRes.data.maxLoginAttempts,
        });
      }
    } catch {
      setSecurityStats((s) => ({ ...s, securityScore: 100 }));
      setSecurityEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePolicies = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await patchSecurityConfig(draft);
      if (res.success) {
        setConfig(res.data);
        setMessage('Security policies saved.');
      }
    } catch {
      setMessage('Could not save policies.');
    } finally {
      setSaving(false);
    }
  };

  const toggleFlag = async (field: 'maintenanceMode' | 'disablePublicRegistration') => {
    if (!config) return;
    if (field === 'disablePublicRegistration' && config.envRegistrationLocked) return;
    setActionLoading(field);
    setMessage('');
    try {
      const res = await patchSecurityConfig({ [field]: !config[field] });
      if (res.success) {
        setConfig(res.data);
        setMessage(
          field === 'maintenanceMode'
            ? res.data.maintenanceMode
              ? 'Maintenance mode enabled.'
              : 'Maintenance mode disabled.'
            : res.data.disablePublicRegistration
              ? 'Public registration disabled.'
              : 'Public registration enabled.'
        );
      }
    } catch {
      setMessage('Action failed.');
    } finally {
      setActionLoading('');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200';
      case 'high':
        return 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200';
      case 'critical':
        return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'login_attempt':
        return <Users className="w-4 h-4" />;
      case 'failed_login':
        return <XCircle className="w-4 h-4" />;
      case 'suspicious_activity':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getSecurityScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <MobileAppShell title="Security" backButtonPath="/dashboard">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400" />
        </div>
      </MobileAppShell>
    );
  }

  const registrationLocked =
    Boolean(config?.disablePublicRegistration) || Boolean(config?.envRegistrationLocked);

  return (
    <MobileAppShell title="Security" backButtonPath="/dashboard">
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="hidden lg:block text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Security Center
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Monitor and manage system security
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Score:{' '}
              <span className={getSecurityScoreColor(securityStats.securityScore)}>
                {securityStats.securityScore}%
              </span>
            </span>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>

        {message && (
          <p className="text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-3 py-2 rounded-lg">
            {message}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Logins" value={securityStats.totalLogins} color="green" icon={Users} />
          <StatCard label="Failed Logins (30d)" value={securityStats.failedLogins} color="red" icon={XCircle} />
          <StatCard
            label="Suspicious IPs (24h)"
            value={securityStats.suspiciousActivities}
            color="orange"
            icon={AlertTriangle}
          />
          <StatCard
            label="Posture checks"
            value={`${postureSummary.passed}/${postureSummary.total}`}
            color="blue"
            icon={Shield}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Security Configuration</h3>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Production posture</p>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {posture.map((check) => (
                  <li key={check.label} className="flex items-start gap-2 text-sm">
                    {check.ok ? (
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <span className="text-gray-800 dark:text-gray-200">
                      {check.label}
                      <span className="block text-xs text-gray-500">{check.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase">Password & login policy</p>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Minimum password length
                </label>
                <input
                  type="number"
                  min={6}
                  max={128}
                  value={draft.passwordMinLength}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, passwordMinLength: parseInt(e.target.value, 10) || 8 }))
                  }
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Max failed logins (15 min lockout)
                </label>
                <input
                  type="number"
                  min={3}
                  max={20}
                  value={draft.maxLoginAttempts}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, maxLoginAttempts: parseInt(e.target.value, 10) || 5 }))
                  }
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-900 dark:border-gray-700"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={draft.requireStrongPassword}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, requireStrongPassword: e.target.checked }))
                  }
                />
                Require letter + number in passwords
              </label>
              {config?.passwordPolicyHint && (
                <p className="text-xs text-gray-500">{config.passwordPolicyHint}</p>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => void savePolicies()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save policies'}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Recent Security Events
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {securityEvents.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No security events in the last 30 days</p>
              ) : (
                securityEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className={`p-2 rounded-lg ${getSeverityColor(event.severity)}`}>
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {event.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Security Actions</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ActionCard
              title="Export signed login log"
              description="Download a 90-day CSV with hash and HMAC verification."
              loading={actionLoading === 'export'}
              onClick={async () => {
                setActionLoading('export');
                try {
                  await downloadLoginLog(90);
                  setMessage('Signed login log downloaded.');
                } catch {
                  setMessage('Export failed.');
                } finally {
                  setActionLoading('');
                }
              }}
              icon={Download}
            />
            <ActionCard
              title={config?.maintenanceMode ? 'Disable maintenance' : 'Enable maintenance'}
              description="Block non-admin API traffic, logins, and new signups."
              loading={actionLoading === 'maintenanceMode'}
              onClick={() => void toggleFlag('maintenanceMode')}
              icon={Lock}
              active={config?.maintenanceMode}
            />
            <ActionCard
              title={registrationLocked ? 'Unlock registration' : 'Lock public registration'}
              description={
                config?.envRegistrationLocked
                  ? 'Also locked via DISABLE_PUBLIC_REGISTRATION env on server.'
                  : 'Only admins can create new users when locked.'
              }
              loading={actionLoading === 'disablePublicRegistration'}
              onClick={() => void toggleFlag('disablePublicRegistration')}
              icon={Users}
              active={registrationLocked}
              disabled={Boolean(config?.envRegistrationLocked)}
            />
          </div>
        </div>
      </div>
    </MobileAppShell>
  );
}

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  color: 'green' | 'red' | 'orange' | 'blue';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const border = {
    green: 'border-green-500',
    red: 'border-red-500',
    orange: 'border-orange-500',
    blue: 'border-blue-500',
  }[color];
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 ${border}`}>
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-gray-500" />
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  title,
  description,
  onClick,
  loading,
  icon: Icon,
  active,
  disabled,
}: {
  title: string;
  description: string;
  onClick: () => void;
  loading?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={loading || disabled}
      onClick={onClick}
      className={`text-left rounded-lg border p-4 transition-colors disabled:opacity-50 ${
        active
          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
      </div>
    </button>
  );
}
