import React from 'react';

const NetworkOfflineBanner: React.FC = () => (
  <div
    className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200"
    role="status"
    aria-live="polite"
  >
    You appear to be offline. Changes may not save until your connection returns.
  </div>
);

export default NetworkOfflineBanner;
