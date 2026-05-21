import React from 'react';
import { StatusBadge } from '../../design-system';
import type { NormalizedFile } from '../../utils/fileTypes';

interface FileGovernanceBadgeProps {
  file?: Partial<NormalizedFile> & { lifecycleLocked?: boolean; scanStatus?: string };
  finalized?: boolean;
  className?: string;
}

const FileGovernanceBadge: React.FC<FileGovernanceBadgeProps> = ({ file, finalized, className = '' }) => {
  if (file?.scanStatus === 'unsafe') {
    return (
      <StatusBadge tone="danger" className={className}>
        Unsafe — blocked
      </StatusBadge>
    );
  }
  if (finalized || file?.lifecycleLocked) {
    return (
      <StatusBadge tone="warning" className={className}>
        Locked (finalized)
      </StatusBadge>
    );
  }
  if (file?.isCurrentVersion === false) {
    return (
      <StatusBadge tone="neutral" className={className}>
        Superseded
      </StatusBadge>
    );
  }
  if (file?.scanStatus === 'pending' || file?.scanStatus === 'scanning') {
    return (
      <StatusBadge tone="info" className={className}>
        {file.scanStatus === 'scanning' ? 'Scanning…' : 'Scan pending'}
      </StatusBadge>
    );
  }
  if (file?.blobQuarantined || file?.cleanupState === 'SOFT_DELETED') {
    return (
      <StatusBadge tone="warning" className={className}>
        Quarantined
      </StatusBadge>
    );
  }
  return null;
};

export default FileGovernanceBadge;
