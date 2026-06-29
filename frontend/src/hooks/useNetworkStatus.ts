import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    const id = window.setInterval(sync, 1000);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      window.clearInterval(id);
    };
  }, []);

  return { online, offline: !online };
}
