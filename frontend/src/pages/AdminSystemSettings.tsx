import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
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
  EyeOff
} from 'lucide-react';

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
  };
}

export function AdminSystemSettings() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [showPassword, setShowPassword] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        
        const response = await axios.get(`${API_URL}/api/admin/settings`, { headers });
        
        if (response.data.success) {
          setConfig(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching system settings:', error);
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
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      await axios.put(`${API_URL}/api/admin/settings`, config, { headers });
      
      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setSaveMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to save settings' 
      });
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!config) return;
    
    setLoading(true);
    setSaveMessage(null);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const response = await axios.post(`${API_URL}/api/admin/settings/test-email`, config.email, { headers });
      
      if (response.data.success) {
        setSaveMessage({ type: 'success', text: response.data.message });
      }
    } catch (error: any) {
      console.error('Error testing email:', error);
      setSaveMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to test email configuration' 
      });
    } finally {
      setLoading(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'email', label: 'Email', icon: Bell },
    { id: 'storage', label: 'Storage', icon: Database }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Failed to load system settings. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600">Configure system parameters and preferences</p>
        </div>
        <div className="flex items-center space-x-3">
          {saveMessage && (
            <div className={`px-4 py-2 rounded-lg ${
              saveMessage.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {saveMessage.text}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'general' && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Site Name</label>
                <input
                  type="text"
                  value={config.general.siteName}
                  onChange={(e) => handleConfigChange('general', 'siteName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Site Description</label>
                <input
                  type="text"
                  value={config.general.siteDescription}
                  onChange={(e) => handleConfigChange('general', 'siteDescription', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Maximum File Size (MB)</label>
                <input
                  type="number"
                  value={config.general.maxFileSize}
                  onChange={(e) => handleConfigChange('general', 'maxFileSize', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Allowed File Types</label>
                <input
                  type="text"
                  value={config.general.allowedFileTypes.join(', ')}
                  onChange={(e) => handleConfigChange('general', 'allowedFileTypes', e.target.value.split(', '))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="pdf, doc, docx, jpg, png"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="maintenanceMode"
                checked={config.general.maintenanceMode}
                onChange={(e) => handleConfigChange('general', 'maintenanceMode', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="maintenanceMode" className="text-sm font-medium text-gray-700">
                Enable Maintenance Mode
              </label>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Security Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Password Length</label>
                <input
                  type="number"
                  value={config.security.passwordMinLength}
                  onChange={(e) => handleConfigChange('security', 'passwordMinLength', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Session Timeout (minutes)</label>
                <input
                  type="number"
                  value={config.security.sessionTimeout}
                  onChange={(e) => handleConfigChange('security', 'sessionTimeout', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Login Attempts</label>
                <input
                  type="number"
                  value={config.security.maxLoginAttempts}
                  onChange={(e) => handleConfigChange('security', 'maxLoginAttempts', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="requireStrongPassword" className="text-sm font-medium text-gray-700">
                  Require Strong Passwords
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="enableTwoFactor"
                  checked={config.security.enableTwoFactor}
                  onChange={(e) => handleConfigChange('security', 'enableTwoFactor', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="enableTwoFactor" className="text-sm font-medium text-gray-700">
                  Enable Two-Factor Authentication
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Email Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Host</label>
                <input
                  type="text"
                  value={config.email.smtpHost}
                  onChange={(e) => handleConfigChange('email', 'smtpHost', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Port</label>
                <input
                  type="number"
                  value={config.email.smtpPort}
                  onChange={(e) => handleConfigChange('email', 'smtpPort', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Username</label>
                <input
                  type="text"
                  value={config.email.smtpUser}
                  onChange={(e) => handleConfigChange('email', 'smtpUser', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={config.email.smtpPassword}
                    onChange={(e) => handleConfigChange('email', 'smtpPassword', e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From Email</label>
                <input
                  type="email"
                  value={config.email.fromEmail}
                  onChange={(e) => handleConfigChange('email', 'fromEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From Name</label>
                <input
                  type="text"
                  value={config.email.fromName}
                  onChange={(e) => handleConfigChange('email', 'fromName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleTestEmail}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                <span>{loading ? 'Testing...' : 'Test Email Configuration'}</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Storage Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Storage per User (GB)</label>
                <input
                  type="number"
                  value={config.storage.maxStoragePerUser}
                  onChange={(e) => handleConfigChange('storage', 'maxStoragePerUser', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Backup Frequency</label>
                <select
                  value={config.storage.backupFrequency}
                  onChange={(e) => handleConfigChange('storage', 'backupFrequency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Retention Days</label>
                <input
                  type="number"
                  value={config.storage.retentionDays}
                  onChange={(e) => handleConfigChange('storage', 'retentionDays', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="compressionEnabled"
                checked={config.storage.compressionEnabled}
                onChange={(e) => handleConfigChange('storage', 'compressionEnabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="compressionEnabled" className="text-sm font-medium text-gray-700">
                Enable File Compression
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 