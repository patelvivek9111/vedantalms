import React from 'react';
import { ds } from './tokens';

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ children, tone = 'neutral', className = '' }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ds.status[tone]} ${className}`}
  >
    {children}
  </span>
);

export default StatusBadge;
