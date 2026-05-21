import React from 'react';
import { ErrorBanner } from '../../design-system';

interface FileAccessBannerProps {
  message?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

const FileAccessBanner: React.FC<FileAccessBannerProps> = ({ message, onRetry, onDismiss }) => {
  if (!message) return null;
  return (
    <ErrorBanner
      className="mb-3"
      message={message}
      onRetry={onRetry || onDismiss}
    />
  );
};

export default FileAccessBanner;
