// Support both Vite environment variables and fallback for production
export const API_URL = (import.meta as any).env?.VITE_API_URL || 
  ((import.meta as any).env?.MODE === 'production' 
    ? 'https://vedantalms-backend.onrender.com'
    : 'http://localhost:5000'); 