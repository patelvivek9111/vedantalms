// Support both Vite environment variables and fallback for production
export const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' 
    ? 'https://vedantaed.com'
    : 'http://localhost:5000'); 