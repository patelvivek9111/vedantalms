import React from 'react';
import { StatusBadge } from '../../design-system';

interface InstitutionalTrustIndicatorsProps {
  lifecycleStatus?: string;
  lastCalculatedAt?: string;
  policyHash?: string;
  className?: string;
}

const InstitutionalTrustIndicators: React.FC<InstitutionalTrustIndicatorsProps> = ({
  lifecycleStatus,
  lastCalculatedAt,
  policyHash,
  className = '',
}) => (
  <div className={`flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400 ${className}`}>
    {lifecycleStatus && (
      <StatusBadge tone={lifecycleStatus === 'FINALIZED' ? 'success' : 'info'}>
        Lifecycle: {lifecycleStatus}
      </StatusBadge>
    )}
    {lastCalculatedAt && <span>Last calculated: {new Date(lastCalculatedAt).toLocaleString()}</span>}
    {policyHash && <span className="font-mono truncate max-w-[140px]" title={policyHash}>Policy {policyHash.slice(0, 8)}…</span>}
  </div>
);

export default InstitutionalTrustIndicators;
