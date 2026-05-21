import React from 'react';
import { ErrorBanner } from '../../design-system';

interface UnsupportedFileBannerProps {
  message?: string;
  onDismiss?: () => void;
}

const UnsupportedFileBanner: React.FC<UnsupportedFileBannerProps> = ({
  message = 'This file type cannot be previewed. You can still download it securely.',
  onDismiss,
}) => <ErrorBanner message={message} onRetry={onDismiss} className="text-sm" />;

export default UnsupportedFileBanner;
