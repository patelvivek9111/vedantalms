import axios from 'axios';
import { API_URL } from '../config';

// Ensure baseURL is properly formatted
const getBaseURL = () => {
  if (!API_URL || API_URL === '') {
    return '/api'; // Relative URL when served from same domain
  }
  return `${API_URL}/api`;
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add the auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const updateUserProfile = async (profile: {
  firstName?: string;
  lastName?: string;
  bio?: string;
  profilePicture?: string;
}) => {
  return api.put('/users/me', profile);
};

export const uploadProfilePicture = async (file: File) => {
  const formData = new FormData();
  formData.append('profilePicture', file);
  return api.post('/users/me/profile-picture', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getUserPreferences = async () => {
  return api.get('/users/me/preferences');
};

export const updateUserPreferences = async (prefs: {
  language?: string;
  timeZone?: string;
  theme?: string;
  courseColors?: { [courseId: string]: string };
}) => {
  return api.put('/users/me/preferences', prefs);
};

export const getLoginActivity = async (page = 1, limit = 20, days = 150) => {
  return api.get(`/auth/login-activity?page=${page}&limit=${limit}&days=${days}`);
};

// Update course overview configuration
export const updateOverviewConfig = async (courseId: string, config: {
  showLatestAnnouncements?: boolean;
  numberOfAnnouncements?: number;
}) => {
  const token = localStorage.getItem('token');
  const response = await api.put(`/courses/${courseId}/overview-config`, config, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Utility function to get full image URL for uploaded files
export const getImageUrl = (filename: string): string => {
  if (!filename) return '';
  if (filename.startsWith('http')) return filename;
  
  // If API_URL is empty (relative URL), use relative path
  if (!API_URL || API_URL === '') {
    // If the path already includes /uploads/, use as-is
    if (filename.startsWith('/uploads/')) {
      return filename;
    }
    // Otherwise, prepend /uploads/
    return `/uploads/${filename}`;
  }
  
  // If API_URL is set, construct full URL
  // If the path already includes /uploads/, just prepend the base URL
  if (filename.startsWith('/uploads/')) {
    return `${API_URL}${filename}`;
  }
  // Otherwise, assume it's just a filename and prepend /uploads/
  return `${API_URL}/uploads/${filename}`;
};

export default api; 