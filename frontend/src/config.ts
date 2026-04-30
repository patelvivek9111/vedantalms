const getApiUrl = () => {
  const envApiUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (envApiUrl && envApiUrl.trim()) {
    const normalized = envApiUrl.trim();
    return normalized.endsWith('/api') ? normalized.slice(0, -4) : normalized;
  }

  // In production without explicit VITE_API_URL, default to same-origin API.
  // This is safe when frontend is served behind the same domain/reverse proxy.
  if ((import.meta as any).env?.MODE === 'production') {
    return '';
  }

  // Development fallback
  return 'http://localhost:5000';
};

export const API_URL = getApiUrl(); 