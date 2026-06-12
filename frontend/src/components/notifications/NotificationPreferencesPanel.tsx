import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  getVisibleInAppToggles,
  isToggleEnabled,
  InAppPreferenceKey,
} from './notificationPreferenceConfig';

type NotificationPreferencesPanelProps = {
  /** Tighter layout for burger menu drawer */
  compact?: boolean;
  showHeading?: boolean;
};

function InAppToggle({
  checked,
  disabled,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">{label}</div>
        <div className="text-[10px] leading-snug text-gray-500 dark:text-gray-400">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
          checked ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer touch-manipulation'}`}
      >
        <span
          className={`pointer-events-none absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export function NotificationPreferencesPanel({
  compact = false,
  showHeading = true,
}: NotificationPreferencesPanelProps) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const toggles = getVisibleInAppToggles(user?.role);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications/preferences');
      if (response.data.success) {
        setPreferences(response.data.data);
      }
    } catch {
      setError('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (keys: InAppPreferenceKey[], enabled: boolean) => {
    if (!preferences) return;

    const previous = preferences;
    const keyUpdates = Object.fromEntries(keys.map((key) => [key, enabled]));
    const updated = {
      ...preferences,
      inApp: {
        ...preferences.inApp,
        ...keyUpdates,
      },
    };

    setPreferences(updated);

    try {
      setSaving(true);
      setError(null);
      await api.put('/notifications/preferences', updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Failed to save preferences');
      setPreferences(previous);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`text-[11px] text-gray-500 dark:text-gray-400 ${compact ? '' : 'py-2'}`}>
        Loading notification preferences...
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className={`text-[11px] text-red-500 dark:text-red-400 ${compact ? '' : 'py-2'}`}>
        Failed to load preferences
      </div>
    );
  }

  return (
    <div className="text-gray-900 dark:text-gray-100">
      {showHeading && (
        <div className={compact ? 'mb-3' : 'mb-4 sm:mb-6'}>
          <h2
            className={`font-bold text-gray-900 dark:text-gray-100 ${
              compact ? 'text-sm mb-1' : 'text-base sm:text-lg lg:text-xl mb-1 sm:mb-2'
            }`}
          >
            Notifications
          </h2>
          <p className={`text-gray-600 dark:text-gray-400 ${compact ? 'text-[10px]' : 'text-xs sm:text-sm lg:text-base'}`}>
            Choose which alerts appear in your notification center.
          </p>
        </div>
      )}

      {error && (
        <div
          className={`mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 ${
            compact ? 'p-2 text-[10px]' : 'mb-4 p-3 text-xs sm:text-sm'
          }`}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className={`mb-3 rounded-lg border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400 ${
            compact ? 'p-2 text-[10px]' : 'mb-4 p-3 text-xs sm:text-sm'
          }`}
        >
          Preferences saved!
        </div>
      )}

      <div
        className={`overflow-hidden rounded-lg border border-gray-200/90 bg-white dark:border-gray-700 dark:bg-gray-800 ${
          compact ? 'px-3 py-1' : 'p-3 sm:p-4 lg:p-6'
        }`}
      >
        <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {toggles.map((toggle) => (
            <InAppToggle
              key={toggle.id}
              label={toggle.label}
              description={toggle.description}
              checked={isToggleEnabled(preferences.inApp, toggle.keys)}
              disabled={saving}
              onChange={(enabled) => handleToggle(toggle.keys, enabled)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default NotificationPreferencesPanel;
