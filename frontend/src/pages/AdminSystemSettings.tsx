import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Settings, 
  Shield, 
  Database, 
  Bell, 
  Lock, 
  Globe,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  GraduationCap,
  Palette
} from 'lucide-react';
import BrandingSettingsTab from '../components/admin/BrandingSettingsTab';
import InstitutionGradingPolicyTab from '../components/admin/InstitutionGradingPolicyTab';
import AcademicSettingsTab from '../components/admin/AcademicSettingsTab';
import OpsDashboardPanel from '../components/admin/OpsDashboardPanel';
import AdminRecoveryCenter from '../components/admin/AdminRecoveryCenter';
import { MobileAppShell } from '../components/common/MobileAppShell';

interface SystemConfig {
  general: {
    siteName: string;
    siteDescription: string;
    maintenanceMode: boolean;
    maxFileSize: number;
    allowedFileTypes: string[];
  };
  security: {
    passwordMinLength: number;
    requireStrongPassword: boolean;
    sessionTimeout: number;
    maxLoginAttempts: number;
    enableTwoFactor: boolean;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
  };
  storage: {
    maxStoragePerUser: number;
    compressionEnabled: boolean;
    backupFrequency: string;
    retentionDays: number;
    deletedBlobRetentionDays?: number;
    deletedFileRetentionDays?: number;
    zipRetentionHours?: number;
  };
  academic?: Record<string, unknown>;
  messaging?: Record<string, unknown>;
}

function normalizeSettingsFromApi(data: SystemConfig): SystemConfig {
  const email = { ...(data.email || ({} as SystemConfig['email'])) };
  return {
    ...data,
    email: {
      smtpHost: email.smtpHost || '',
      smtpPort: Number(email.smtpPort) || 587,
      smtpUser: email.smtpUser || '',
      smtpPassword: '',
      fromEmail: email.fromEmail || '',
      fromName: email.fromName || 'MySl8te',
    },
  };
}

function buildSettingsPayload(config: SystemConfig) {
  const email = { ...config.email };
  const typedPassword = String(email.smtpPassword || '').trim();
  // Blank or leftover mask ⇒ keep existing SMTP password on the server.
  if (!typedPassword || /^\*+$/.test(typedPassword)) {
    delete (email as { smtpPassword?: string }).smtpPassword;
  } else {
    email.smtpPassword = typedPassword;
  }
  const port = Number(email.smtpPort);
  email.smtpPort = Number.isFinite(port) && port > 0 ? port : 587;

  return {
    general: config.general,
    security: config.security,
    email,
    storage: config.storage,
    ...(config.academic ? { academic: config.academic } : {}),
    ...(config.messaging ? { messaging: config.messaging } : {}),
  };
}

export function AdminSystemSettings() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [smtpPasswordConfigured, setSmtpPasswordConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [showPassword, setShowPassword] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showFileRecovery, setShowFileRecovery] = useState(false);

  useEffect(() => {
    if (activeTab !== 'operations') {
      setShowFileRecovery(false);
      return;
    }
    const id = window.setTimeout(() => setShowFileRecovery(true), 100);
    return () => window.clearTimeout(id);
  }, [activeTab]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/admin/settings');
        
        if (response.data.success) {
          const raw = response.data.data;
          setSmtpPasswordConfigured(Boolean(raw?.email?.smtpPassword));
          setConfig(normalizeSettingsFromApi(raw));
        }
      } catch (error) {
        setSaveMessage({ type: 'error', text: 'Failed to load system settings' });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleConfigChange = (section: keyof SystemConfig, field: string, value: any) => {
    if (!config) return;
    
    setConfig(prev => ({
      ...prev!,
      [section]: {
        ...prev![section],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!config) return;
    
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload = buildSettingsPayload(config);
      const passwordChanging = Boolean(payload.email.smtpPassword);
      const response = await api.put('/admin/settings', payload);
      if (response.data?.data) {
        const raw = response.data.data;
        if (passwordChanging) setSmtpPasswordConfigured(true);
        else setSmtpPasswordConfigured(Boolean(raw?.email?.smtpPassword) || smtpPasswordConfigured);
        setConfig(normalizeSettingsFromApi(raw));
      }
      setSaveMessage({
        type: 'success',
        text: passwordChanging
          ? 'Settings saved successfully (SMTP password updated).'
          : 'Settings saved successfully!',
      });
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (error: any) {
      const status = error.response?.status;
      const message =
        status === 401 || status === 403
          ? 'Session expired or not authorized. Sign in again, then retry Save.'
          : error.response?.data?.message || 'Failed to save settings';
      setSaveMessage({ type: 'error', text: message });
      setTimeout(() => setSaveMessage(null), 8000);
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!config) return;
    
    setTestingEmail(true);
    setSaveMessage(null);
    try {
      const response = await api.post('/admin/settings/test-email', buildSettingsPayload(config).email);
      
      if (response.data.success) {
        setSaveMessage({ type: 'success', text: response.data.message });
      }
    } catch (error: any) {
      const status = error.response?.status;
      setSaveMessage({ 
        type: 'error', 
        text:
          status === 401 || status === 403
            ? 'Session expired or not authorized. Sign in again, then retry the test.'
            : error.response?.data?.message || 'Failed to test email configuration',
      });
    } finally {
      setTestingEmail(false);
      setTimeout(() => setSaveMessage(null), 8000);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'email', label: 'Email', icon: Bell },
    { id: 'storage', label: 'Storage', icon: Database },
    { id: 'grading', label: 'Grading', icon: GraduationCap },
    { id: 'academic', label: 'Academic', icon: Globe },
    { id: 'operations', label: 'Operations', icon: RefreshCw }
  ];

  if (loading) {
    return (
      <MobileAppShell title="Settings" backButtonPath="/dashboard">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400"></div>
        </div>
      </MobileAppShell>
    );
  }

  if (!config) {
    return (
      <MobileAppShell title="Settings" backButtonPath="/dashboard">
        <div className="p-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-400">Failed to load system settings. Please refresh the page.</p>
          </div>
        </div>
      </MobileAppShell>
    );
  }

  return (
    <MobileAppShell title="Settings" backButtonPath="/dashboard">
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div>
          <h1 className="hidden lg:block text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">System Settings</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Configure system parameters and preferences</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-3 w-full sm:w-auto">
          {saveMessage && (
            <div className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${
              saveMessage.type === 'success' 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}>
              {saveMessage.text}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 text-sm sm:text-base"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Tabs — mobile select */}
      <div className="lg:hidden">
        <label htmlFor="settings-tab-select" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Settings section
        </label>
        <select
          id="settings-tab-select"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs — desktop */}
      <div className="hidden border-b border-gray-200 dark:border-gray-700 lg:block">
        <nav className="-mb-px flex flex-wrap space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[44px] items-center space-x-2 border-b-2 px-1 py-2 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {activeTab === 'general' && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">General Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Site Name</label>
                <input
                  id="siteName"
                  name="siteName"
                  type="text"
                  value={config.general.siteName}
                  onChange={(e) => handleConfigChange('general', 'siteName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Institution display name (synced with Account name and login brand).
                </p>
              </div>

              <div>
                <label htmlFor="siteDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Site Description</label>
                <input
                  id="siteDescription"
                  name="siteDescription"
                  type="text"
                  value={config.general.siteDescription}
                  onChange={(e) => handleConfigChange('general', 'siteDescription', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="maxFileSize" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Maximum File Size (MB)</label>
                <input
                  id="maxFileSize"
                  name="maxFileSize"
                  type="number"
                  value={config.general.maxFileSize}
                  onChange={(e) => handleConfigChange('general', 'maxFileSize', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="allowedFileTypes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Allowed File Types</label>
                <input
                  id="allowedFileTypes"
                  name="allowedFileTypes"
                  type="text"
                  value={config.general.allowedFileTypes.join(', ')}
                  onChange={(e) => handleConfigChange('general', 'allowedFileTypes', e.target.value.split(', '))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  placeholder="pdf, doc, docx, jpg, png, mp4, mov"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="maintenanceMode"
                checked={config.general.maintenanceMode}
                onChange={(e) => handleConfigChange('general', 'maintenanceMode', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
              />
              <label htmlFor="maintenanceMode" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Maintenance Mode
              </label>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Security Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="securityPasswordMinLength" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Minimum Password Length</label>
                <input
                  id="securityPasswordMinLength"
                  name="securityPasswordMinLength"
                  type="number"
                  value={config.security.passwordMinLength}
                  onChange={(e) => handleConfigChange('security', 'passwordMinLength', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="sessionTimeout" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Session Timeout (minutes)</label>
                <input
                  id="sessionTimeout"
                  name="sessionTimeout"
                  type="number"
                  value={config.security.sessionTimeout}
                  onChange={(e) => handleConfigChange('security', 'sessionTimeout', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Controls login session length for this institution (JWT + cookie). Applies on next login.
                </p>
              </div>

              <div>
                <label htmlFor="securityMaxLoginAttempts" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Maximum Login Attempts</label>
                <input
                  id="securityMaxLoginAttempts"
                  name="securityMaxLoginAttempts"
                  type="number"
                  value={config.security.maxLoginAttempts}
                  onChange={(e) => handleConfigChange('security', 'maxLoginAttempts', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="requireStrongPassword"
                  checked={config.security.requireStrongPassword}
                  onChange={(e) => handleConfigChange('security', 'requireStrongPassword', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <label htmlFor="requireStrongPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Require Strong Passwords
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="enableTwoFactor"
                  checked={config.security.enableTwoFactor}
                  disabled
                  readOnly
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
                />
                <div>
                  <label htmlFor="enableTwoFactor" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Two-Factor Authentication
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    MFA requires a full TOTP enrollment flow and is not available yet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Email Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="smtpHost" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">SMTP Host</label>
                <input
                  id="smtpHost"
                  name="smtpHost"
                  type="text"
                  value={config.email.smtpHost}
                  onChange={(e) => handleConfigChange('email', 'smtpHost', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="smtpPort" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">SMTP Port</label>
                <input
                  id="smtpPort"
                  name="smtpPort"
                  type="number"
                  value={config.email.smtpPort}
                  onChange={(e) =>
                    handleConfigChange(
                      'email',
                      'smtpPort',
                      Number.parseInt(e.target.value, 10) || 587
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="smtpUser" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">SMTP Username</label>
                <input
                  id="smtpUser"
                  name="smtpUser"
                  autoComplete="username"
                  type="text"
                  value={config.email.smtpUser}
                  onChange={(e) => handleConfigChange('email', 'smtpUser', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="smtpPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  SMTP Password
                </label>
                <div className="relative">
                  <input
                    id="smtpPassword"
                    name="smtpPassword"
                    autoComplete="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={config.email.smtpPassword}
                    placeholder={
                      smtpPasswordConfigured
                        ? 'Leave blank to keep current password'
                        : 'Enter SMTP password'
                    }
                    onChange={(e) => handleConfigChange('email', 'smtpPassword', e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-gray-400 dark:text-gray-500" /> : <Eye className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {smtpPasswordConfigured
                    ? 'A password is already saved. Type a new one only if you want to replace it, then click Save Changes.'
                    : 'Required for sending mail. Save after entering it.'}
                </p>
              </div>

              <div>
                <label htmlFor="fromEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">From Email</label>
                <input
                  id="fromEmail"
                  name="fromEmail"
                  type="email"
                  value={config.email.fromEmail}
                  onChange={(e) => handleConfigChange('email', 'fromEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="fromName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">From Name</label>
                <input
                  id="fromName"
                  name="fromName"
                  type="text"
                  value={config.email.fromName}
                  onChange={(e) => handleConfigChange('email', 'fromName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testingEmail || saving}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50"
              >
                {testingEmail ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                <span>{testingEmail ? 'Testing...' : 'Test Email Configuration'}</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Storage Settings</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Soft limits for this institution. The platform plan quota is the hard ceiling and cannot be exceeded.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="maxStoragePerUser" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Maximum Storage per User (GB)</label>
                <input
                  id="maxStoragePerUser"
                  name="maxStoragePerUser"
                  type="number"
                  value={config.storage.maxStoragePerUser}
                  onChange={(e) => handleConfigChange('storage', 'maxStoragePerUser', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="backupFrequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Backup Frequency</label>
                <select
                  id="backupFrequency"
                  name="backupFrequency"
                  value={config.storage.backupFrequency}
                  onChange={(e) => handleConfigChange('storage', 'backupFrequency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label htmlFor="retentionDays" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Retention Days</label>
                <input
                  id="retentionDays"
                  name="retentionDays"
                  type="number"
                  value={config.storage.retentionDays}
                  onChange={(e) => handleConfigChange('storage', 'retentionDays', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="deletedBlobRetentionDays" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Deleted blob retention (days)</label>
                <input
                  id="deletedBlobRetentionDays"
                  name="deletedBlobRetentionDays"
                  type="number"
                  value={config.storage.deletedBlobRetentionDays ?? config.storage.retentionDays}
                  onChange={(e) => handleConfigChange('storage', 'deletedBlobRetentionDays', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="deletedFileRetentionDays" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Deleted file metadata retention (days)</label>
                <input
                  id="deletedFileRetentionDays"
                  name="deletedFileRetentionDays"
                  type="number"
                  value={config.storage.deletedFileRetentionDays ?? config.storage.retentionDays}
                  onChange={(e) => handleConfigChange('storage', 'deletedFileRetentionDays', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="zipRetentionHours" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ZIP export retention (hours)</label>
                <input
                  id="zipRetentionHours"
                  name="zipRetentionHours"
                  type="number"
                  value={config.storage.zipRetentionHours ?? 72}
                  onChange={(e) => handleConfigChange('storage', 'zipRetentionHours', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="compressionEnabled"
                checked={config.storage.compressionEnabled}
                onChange={(e) => handleConfigChange('storage', 'compressionEnabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
              />
              <label htmlFor="compressionEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable File Compression
              </label>
            </div>
          </div>
        )}

        {activeTab === 'branding' && <BrandingSettingsTab />}
        {activeTab === 'grading' && <InstitutionGradingPolicyTab />}
        {activeTab === 'academic' && <AcademicSettingsTab />}
        {activeTab === 'operations' && (
          <div className="space-y-8">
            <OpsDashboardPanel />
            {showFileRecovery && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 px-6 pb-6">
                <AdminRecoveryCenter />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </MobileAppShell>
  );
} 