import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiUtils';

const api = axios.create({
  baseURL: getApiBaseUrl(),
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

export default api; 