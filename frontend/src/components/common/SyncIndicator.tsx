import React from 'react';
import { Wifi, WifiOff, Loader2, CheckCircle, AlertCircle, Cloud, CloudOff } from 'lucide-react';
import { SyncStatus } from '../../hooks/useOfflineSync';

interface SyncIndicatorProps {
  status: SyncStatus;
  pendingCount: number;
  isOnline: boolean;
  onClick?: () => void;
  className?: string;
}

const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  status,
  pendingCount,
  isOnline,
  onClick,
  className = ''
}) => {
  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: <WifiOff className="w-4 h-4" />,
        text: 'Offline',
        color: 'text-gray-600 dark:text-gray-400',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-300 dark:border-gray-700'
      };
    }

    switch (status) {
      case 'syncing':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          text: pendingCount > 0 ? `Syncing ${pendingCount}...` : 'Syncing...',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800'
        };
      case 'synced':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          text: 'Synced',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800'
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: 'Sync failed',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800'
        };
      case 'offline':
        return {
          icon: <CloudOff className="w-4 h-4" />,
          text: pendingCount > 0 ? `${pendingCount} pending` : 'Offline',
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
          borderColor: 'border-orange-200 dark:border-orange-800'
        };
      default:
        return {
          icon: <Cloud className="w-4 h-4" />,
          text: pendingCount > 0 ? `${pendingCount} pending` : 'Online',
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-800',
          borderColor: 'border-gray-200 dark:border-gray-700'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium
        transition-all duration-200
        ${config.color} ${config.bgColor} ${config.borderColor}
        ${onClick ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default'}
        ${className}
      `}
      aria-label={`Sync status: ${config.text}`}
      disabled={!onClick}
    >
      {config.icon}
      <span>{config.text}</span>
    </button>
  );
};

export default SyncIndicator;

