// Support both Vite environment variables and fallback for production
// If frontend is served from same domain as backend, use relative URL
const getApiUrl = () => {
  // PRIORITY 1: Runtime check - if on vedantaed.com, use backend URL directly
  // Since Vercel (frontend) and Render (backend) are on different domains,
  // we need to point to the backend URL directly
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('vedantaed.com')) {
      // Frontend is on Vercel, backend is on Render - use backend URL
      return 'https://vedantalms-backend.onrender.com';
    }
  }
  
  // PRIORITY 2: Check for explicit environment variable (only if not on vedantaed.com)
  if ((import.meta as any).env?.VITE_API_URL) {
    const envUrl = (import.meta as any).env.VITE_API_URL;
    // Remove trailing /api if present to avoid double /api/api
    if (envUrl.endsWith('/api')) {
      return envUrl.slice(0, -4);
    }
    return envUrl;
  }
  
  // PRIORITY 3: In production, check if on Render domain
  if ((import.meta as any).env?.MODE === 'production') {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname.includes('onrender.com')) {
        return ''; // Use relative URL (same domain) - avoids CORS
      }
    }
    // Fallback to Render backend URL (shouldn't happen if properly configured)
    return 'https://vedantalms-backend.onrender.com';
  }
  
  // Development: use localhost
  return 'http://localhost:5000';
};

export const API_URL = getApiUrl(); 