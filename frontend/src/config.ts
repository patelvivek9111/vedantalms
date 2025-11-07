// Support both Vite environment variables and fallback for production
// If frontend is served from same domain as backend, use relative URL
const getApiUrl = () => {
  // Check for explicit environment variable
  if ((import.meta as any).env?.VITE_API_URL) {
    return (import.meta as any).env.VITE_API_URL;
  }
  
  // In production, check if we're on the same domain
  if ((import.meta as any).env?.MODE === 'production') {
    // If frontend is served from same domain as backend, use relative URL (same domain)
    // Check window.location at runtime (safe for browser)
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      // Use relative URL if on custom domain or Render domain (same origin)
      if (hostname.includes('vedantaed.com') || hostname.includes('onrender.com')) {
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